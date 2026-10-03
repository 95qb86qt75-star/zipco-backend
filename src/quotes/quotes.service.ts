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
import { DataSource, IsNull, Repository } from 'typeorm';
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
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { ProposeQuoteAlternativeDto } from './dto/propose-quote-alternative.dto';

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
      where: { userId, customerDeletedAt: IsNull() },
      order: { updatedAt: 'DESC' },
    });
  }

  async findByBusiness(businessId: number, currentUser: CurrentUser) {
    await this.ensureBusinessOwner(businessId, currentUser);
    const quotes = await this.quoteRepository.find({
      where: { businessId, businessDeletedAt: IsNull() },
      order: { updatedAt: 'DESC' },
    });
    const photos = new Map<number, string | null>();
    await Promise.all(
      [...new Set(quotes.map((quote) => quote.userId))].map(async (userId) => {
        const user = await this.usersService.findOne(userId);
        photos.set(userId, user?.photo ?? null);
      }),
    );
    return quotes.map((quote) => ({
      ...quote,
      customerPhoto: photos.get(quote.userId) ?? null,
    }));
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

  async proposeAlternative(
    id: number,
    data: ProposeQuoteAlternativeDto,
    currentUser: CurrentUser,
  ) {
    const quote = await this.findOne(id);
    await this.ensureBusinessOwner(quote.businessId, currentUser);
    if (quote.status !== 'requested')
      throw new BadRequestException(
        'Solo puedes proponer una alternativa antes de responder',
      );
    const message = data.message.trim();
    const result = await this.quoteRepository.update(
      { id, status: 'requested' },
      {
        status: 'alternative_proposed',
        alternativeDate: data.date ?? null,
        alternativeTime: data.time ?? null,
        alternativeItem: data.item?.trim() || null,
        alternativeQuantity: data.quantity ?? null,
        alternativePriceClp: data.priceClp ?? null,
        alternativeMessage: message,
      },
    );
    if (!result.affected)
      throw new ConflictException(
        'La solicitud cambio. Actualiza e intenta nuevamente',
      );
    const updated = await this.findOne(id);
    await this.pushNotifications?.notifyQuoteAlternative(updated);
    return updated;
  }

  async updateStatus(
    id: number,
    data: UpdateQuoteStatusDto,
    currentUser: CurrentUser,
  ) {
    const quote = await this.findOne(id);
    const ownerUserId = await this.findBusinessOwnerUserId(quote.businessId);
    const isCustomer = quote.userId === currentUser.id;
    const isBusiness = ownerUserId === currentUser.id;
    const isAdmin = currentUser.role === 'admin';
    if (!isCustomer && !isBusiness && !isAdmin) {
      throw new ForbiddenException(
        'No tienes permiso para modificar esta cotizacion',
      );
    }
    const allowed =
      ((isCustomer || isAdmin) &&
        ['quoted', 'alternative_proposed'].includes(quote.status) &&
        ['accepted', 'declined'].includes(data.status)) ||
      ((isCustomer || isAdmin) &&
        ['requested', 'quoted'].includes(quote.status) &&
        data.status === 'cancelled') ||
      ((isBusiness || isAdmin) &&
        quote.status === 'requested' &&
        data.status === 'declined') ||
      ((isBusiness || isAdmin) &&
        quote.status === 'accepted' &&
        data.status === 'ready') ||
      ((isCustomer || isAdmin) &&
        quote.status === 'ready' &&
        data.status === 'completed');
    if (!allowed)
      throw new BadRequestException('Transicion de cotizacion no valida');
    if (data.status === 'cancelled' && !data.reason) {
      throw new BadRequestException('Debes indicar un motivo de cancelacion');
    }
    if (
      isBusiness &&
      quote.status === 'requested' &&
      data.status === 'declined' &&
      !data.reason
    ) {
      throw new BadRequestException('Debes indicar un motivo de rechazo');
    }
    if (data.reason === 'other' && !data.reasonDetail?.trim()) {
      throw new BadRequestException('Debes escribir el otro motivo');
    }
    const update: Partial<QuoteRequest> = {
      status: data.status,
      closureReason: data.reason ?? null,
      closureReasonDetail: data.reasonDetail?.trim() || null,
    };
    if (
      quote.status === 'alternative_proposed' &&
      data.status === 'accepted' &&
      quote.alternativePriceClp
    ) {
      update.quotedPriceClp = quote.alternativePriceClp;
    }
    const result = await this.quoteRepository.update(
      { id, status: quote.status },
      update,
    );
    if (!result.affected)
      throw new ConflictException(
        'La cotizacion cambio. Actualiza e intenta nuevamente',
      );
    const updatedQuote = await this.findOne(id);
    await this.pushNotifications?.notifyQuoteStatusChanged(
      updatedQuote,
      isCustomer ? ownerUserId : quote.userId,
      data.status,
      isCustomer ? 'business' : 'customer',
    );
    return updatedQuote;
  }

  /** Compatibilidad interna para llamadas anteriores; la API usa updateStatus. */
  updateCustomerStatus(
    id: number,
    status: 'accepted' | 'declined' | 'cancelled',
    currentUser: CurrentUser,
  ) {
    return this.updateStatus(
      id,
      { status } as UpdateQuoteStatusDto,
      currentUser,
    );
  }

  async setArchived(id: number, archived: boolean, currentUser: CurrentUser) {
    const quote = await this.findOne(id);
    if (!['completed', 'declined', 'cancelled'].includes(quote.status)) {
      throw new BadRequestException(
        'Solo puedes archivar cotizaciones finalizadas',
      );
    }
    const ownerUserId = await this.findBusinessOwnerUserId(quote.businessId);
    const isCustomer = quote.userId === currentUser.id;
    const isBusiness = ownerUserId === currentUser.id;
    if (!isCustomer && !isBusiness && currentUser.role !== 'admin') {
      throw new ForbiddenException(
        'No tienes permiso para archivar esta cotizacion',
      );
    }
    const field = isCustomer ? 'customerArchivedAt' : 'businessArchivedAt';
    await this.quoteRepository.update(id, {
      [field]: archived ? new Date() : null,
    });
    return this.findOne(id);
  }

  async setPermanentlyDeleted(id: number, currentUser: CurrentUser) {
    const quote = await this.findOne(id);
    const ownerUserId = await this.findBusinessOwnerUserId(quote.businessId);
    const isCustomer = quote.userId === currentUser.id;
    const isBusiness = ownerUserId === currentUser.id;
    if (!isCustomer && !isBusiness && currentUser.role !== 'admin') {
      throw new ForbiddenException(
        'No tienes permiso para eliminar esta cotizacion',
      );
    }
    const archivedAt = isCustomer
      ? quote.customerArchivedAt
      : quote.businessArchivedAt;
    if (!archivedAt)
      throw new BadRequestException('Primero mueve la cotizacion a Eliminados');
    const field: 'customerDeletedAt' | 'businessDeletedAt' = isCustomer
      ? 'customerDeletedAt'
      : 'businessDeletedAt';
    await this.quoteRepository.update(id, { [field]: new Date() });
    return { deleted: true };
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
