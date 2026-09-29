import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Business } from '../businesses/business.entity';
import {
  CatalogItem,
  CatalogItemPricingMode,
} from '../catalog/catalog-item.entity';
import { UsersService } from '../users/users.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { RespondQuoteDto } from './dto/respond-quote.dto';
import { QuoteRequest } from './quote-request.entity';
import { PushNotificationsService } from '../notifications/push-notifications.service';

type CurrentUser = { id?: number; role?: string };

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(QuoteRequest)
    private readonly quoteRepository: Repository<QuoteRequest>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly pushNotifications?: PushNotificationsService,
  ) {}

  async create(data: CreateQuoteDto, userId?: number) {
    if (!Number.isInteger(userId) || (userId ?? 0) <= 0)
      throw new UnauthorizedException('Sesion no valida');
    const existing = await this.quoteRepository.findOne({
      where: { userId, idempotencyKey: data.idempotencyKey },
    });
    if (existing) return existing;
    const user = await this.usersService.findOne(userId as number);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    const message = data.message.trim();
    if (!message) throw new BadRequestException('Describe lo que necesitas');
    if (!data.needNow && (!data.requestedDate || !data.requestedTime))
      throw new BadRequestException('Selecciona una fecha y hora');

    let ownerUserId = 0;
    try {
      const quote = await this.dataSource.transaction(async (manager) => {
        const business = await manager.findOne(Business, {
          where: { id: data.businessId, status: 'approved' },
          select: { id: true, userId: true },
        });
        if (!business) throw new NotFoundException('Negocio no encontrado');
        ownerUserId = business.userId;
        if (business.userId === userId)
          throw new ForbiddenException(
            'No puedes cotizar en tu propio negocio',
          );
        const item = await manager.findOne(CatalogItem, {
          where: {
            id: data.catalogItemId,
            businessId: data.businessId,
            isActive: true,
            pricingMode: CatalogItemPricingMode.QUOTE,
          },
        });
        if (!item)
          throw new ConflictException(
            'El catalogo cambio. Actualiza e intenta nuevamente',
          );
        return manager.getRepository(QuoteRequest).save(
          manager.getRepository(QuoteRequest).create({
            businessId: data.businessId,
            catalogItemId: item.id,
            userId: userId as number,
            customerName: user.name,
            customerPhone: user.phone ?? null,
            itemNameSnapshot: item.name,
            itemDescriptionSnapshot: item.description,
            startingPriceClpSnapshot: item.startingPriceClp,
            message,
            needNow: data.needNow ?? false,
            requestedDate: data.needNow ? null : (data.requestedDate ?? null),
            requestedTime: data.needNow ? null : (data.requestedTime ?? null),
            referencePhoto: data.referencePhoto ?? null,
            status: 'requested',
            quotedPriceClp: null,
            businessMessage: null,
            idempotencyKey: data.idempotencyKey,
          }),
        );
      });
      await this.pushNotifications?.notifyNewQuote(quote, ownerUserId);
      return quote;
    } catch (error: any) {
      if (error?.code === '23505') {
        const duplicate = await this.quoteRepository.findOne({
          where: { userId, idempotencyKey: data.idempotencyKey },
        });
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  findByUser(userId: number) {
    return this.quoteRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByBusiness(businessId: number, currentUser: CurrentUser) {
    await this.ensureBusinessOwner(businessId, currentUser);
    return this.quoteRepository.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  async respond(id: number, data: RespondQuoteDto, currentUser: CurrentUser) {
    const quote = await this.findOne(id);
    await this.ensureBusinessOwner(quote.businessId, currentUser);
    if (quote.status !== 'requested')
      throw new BadRequestException('La solicitud ya fue respondida');
    const result = await this.quoteRepository.update(
      { id, status: 'requested' },
      {
        status: 'quoted',
        quotedPriceClp: data.priceClp,
        businessMessage: data.message?.trim() || null,
      },
    );
    if (!result.affected)
      throw new ConflictException(
        'La solicitud cambio. Actualiza e intenta nuevamente',
      );
    const updatedQuote = await this.findOne(id);
    await this.pushNotifications?.notifyQuoteResponded(updatedQuote);
    return updatedQuote;
  }

  async updateCustomerStatus(
    id: number,
    status: 'accepted' | 'declined' | 'cancelled',
    currentUser: CurrentUser,
  ) {
    const quote = await this.findOne(id);
    if (quote.userId !== currentUser.id && currentUser.role !== 'admin')
      throw new ForbiddenException(
        'No tienes permiso para modificar esta cotizacion',
      );
    const allowed =
      status === 'cancelled' ? ['requested', 'quoted'] : ['quoted'];
    if (!allowed.includes(quote.status))
      throw new BadRequestException('Transicion de cotizacion no valida');
    const result = await this.quoteRepository.update(
      { id, status: quote.status },
      { status },
    );
    if (!result.affected)
      throw new ConflictException(
        'La cotizacion cambio. Actualiza e intenta nuevamente',
      );
    const updatedQuote = await this.findOne(id);
    const ownerUserId = await this.findBusinessOwnerUserId(quote.businessId);
    await this.pushNotifications?.notifyQuoteStatusChanged(
      updatedQuote,
      ownerUserId,
      status,
    );
    return updatedQuote;
  }

  private async findOne(id: number) {
    const quote = await this.quoteRepository.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Cotizacion no encontrada');
    return quote;
  }

  private async ensureBusinessOwner(
    businessId: number,
    currentUser: CurrentUser,
  ) {
    const business = await this.dataSource.getRepository(Business).findOne({
      where: { id: businessId },
      select: { id: true, userId: true },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    if (business.userId !== currentUser.id && currentUser.role !== 'admin')
      throw new ForbiddenException(
        'No tienes permiso para ver estas cotizaciones',
      );
  }

  private async findBusinessOwnerUserId(businessId: number): Promise<number> {
    const business = await this.dataSource.getRepository(Business).findOne({
      where: { id: businessId },
      select: { id: true, userId: true },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    return business.userId;
  }
}
