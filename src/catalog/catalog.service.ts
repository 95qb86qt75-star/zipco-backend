import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../businesses/business.entity';
import { CatalogItem, CatalogItemPricingMode } from './catalog-item.entity';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';

type CurrentUser = { id?: number };

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(CatalogItem)
    private readonly catalogRepository: Repository<CatalogItem>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  private async ensureOwner(
    businessId: number,
    currentUser?: CurrentUser,
  ): Promise<void> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
      select: { id: true, userId: true },
    });

    if (!business) {
      throw new NotFoundException('Negocio no encontrado');
    }

    if (!currentUser?.id || business.userId !== currentUser.id) {
      throw new ForbiddenException(
        'No tienes permiso para administrar este catalogo',
      );
    }
  }

  private ensureValidPricing(data: {
    pricingMode: CatalogItemPricingMode;
    priceClp: number | null;
    startingPriceClp: number | null;
  }): void {
    const { pricingMode, priceClp, startingPriceClp } = data;

    if (
      pricingMode === CatalogItemPricingMode.FIXED_PRICE &&
      (!Number.isInteger(priceClp) ||
        (priceClp ?? 0) < 100 ||
        startingPriceClp !== null)
    ) {
      throw new BadRequestException(
        'El precio fijo exige priceClp positivo y no permite startingPriceClp',
      );
    }

    if (
      pricingMode === CatalogItemPricingMode.QUOTE &&
      (priceClp !== null ||
        (startingPriceClp !== null &&
          (!Number.isInteger(startingPriceClp) || startingPriceClp < 100)))
    ) {
      throw new BadRequestException(
        'La cotizacion no permite priceClp y su precio inicial debe ser positivo',
      );
    }

    if (
      pricingMode === CatalogItemPricingMode.VIEW &&
      (priceClp !== null || startingPriceClp !== null)
    ) {
      throw new BadRequestException('Solo ver no permite precios');
    }
  }

  private async findOwnedItem(
    businessId: number,
    itemId: number,
    currentUser?: CurrentUser,
  ): Promise<CatalogItem> {
    await this.ensureOwner(businessId, currentUser);
    const item = await this.catalogRepository.findOne({
      where: { id: itemId, businessId },
    });

    if (!item) {
      throw new NotFoundException('Articulo de catalogo no encontrado');
    }

    return item;
  }

  async findPublic(businessId: number): Promise<CatalogItem[]> {
    const isPublicBusiness = await this.businessRepository.existsBy({
      id: businessId,
      status: 'approved',
    });
    if (!isPublicBusiness) {
      throw new NotFoundException('Negocio no encontrado');
    }

    return this.catalogRepository.find({
      where: { businessId, isActive: true },
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  }

  async findManaged(
    businessId: number,
    currentUser?: CurrentUser,
  ): Promise<CatalogItem[]> {
    await this.ensureOwner(businessId, currentUser);
    return this.findAllOrdered(businessId);
  }

  async create(
    businessId: number,
    data: CreateCatalogItemDto,
    currentUser?: CurrentUser,
  ): Promise<CatalogItem> {
    await this.ensureOwner(businessId, currentUser);
    const previous = await this.catalogRepository.findOne({
      where: { businessId },
      order: { displayOrder: 'DESC', id: 'DESC' },
      select: { displayOrder: true },
    });
    const priceClp = data.priceClp ?? null;
    const startingPriceClp = data.startingPriceClp ?? null;
    this.ensureValidPricing({
      pricingMode: data.pricingMode,
      priceClp,
      startingPriceClp,
    });

    const item = this.catalogRepository.create({
      businessId,
      name: data.name.trim(),
      description: data.description.trim(),
      kind: data.kind,
      pricingMode: data.pricingMode,
      priceClp,
      startingPriceClp,
      imageUrl: data.imageUrl.trim(),
      isActive: true,
      displayOrder: (previous?.displayOrder ?? -1) + 1,
    });

    return this.catalogRepository.save(item);
  }

  async update(
    businessId: number,
    itemId: number,
    data: UpdateCatalogItemDto,
    currentUser?: CurrentUser,
  ): Promise<CatalogItem> {
    const item = await this.findOwnedItem(businessId, itemId, currentUser);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Debes enviar al menos un campo editable');
    }

    const pricingMode = data.pricingMode ?? item.pricingMode;
    const priceClp =
      data.priceClp === undefined ? item.priceClp : data.priceClp;
    const startingPriceClp =
      data.startingPriceClp === undefined
        ? item.startingPriceClp
        : data.startingPriceClp;
    this.ensureValidPricing({ pricingMode, priceClp, startingPriceClp });

    Object.assign(item, data, {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined
        ? { description: data.description.trim() }
        : {}),
      ...(data.imageUrl !== undefined
        ? { imageUrl: data.imageUrl.trim() }
        : {}),
      pricingMode,
      priceClp,
      startingPriceClp,
    });

    return this.catalogRepository.save(item);
  }

  async updateStatus(
    businessId: number,
    itemId: number,
    isActive: boolean,
    currentUser?: CurrentUser,
  ): Promise<CatalogItem> {
    const item = await this.findOwnedItem(businessId, itemId, currentUser);
    item.isActive = isActive;
    return this.catalogRepository.save(item);
  }

  async reorder(
    businessId: number,
    itemIds: number[],
    currentUser?: CurrentUser,
  ): Promise<CatalogItem[]> {
    await this.ensureOwner(businessId, currentUser);

    await this.catalogRepository.manager.transaction(async (manager) => {
      const currentItems = await manager.find(CatalogItem, {
        where: { businessId },
        select: { id: true },
      });
      const currentIds = new Set(currentItems.map((item) => item.id));

      if (
        currentIds.size !== itemIds.length ||
        new Set(itemIds).size !== itemIds.length ||
        itemIds.some((id) => !currentIds.has(id))
      ) {
        throw new BadRequestException(
          'Debes enviar todos los articulos del catalogo exactamente una vez',
        );
      }

      for (const [displayOrder, id] of itemIds.entries()) {
        await manager.update(CatalogItem, { id, businessId }, { displayOrder });
      }
    });

    return this.findAllOrdered(businessId);
  }

  private findAllOrdered(businessId: number): Promise<CatalogItem[]> {
    return this.catalogRepository.find({
      where: { businessId },
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  }
}
