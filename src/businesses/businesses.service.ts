import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SelectQueryBuilder, Repository } from 'typeorm';
import { Business } from './business.entity';
import { Category } from '../categories/category.entity';

type CurrentUser = {
  id?: number;
  role?: string;
};

export type PublicBusinessResponse = Pick<
  Business,
  | 'id'
  | 'name'
  | 'description'
  | 'type'
  | 'photo'
  | 'category'
  | 'categoryId'
  | 'schedule'
  | 'instagram'
  | 'facebook'
  | 'isOpen'
  | 'showOnlyDistance'
  | 'userId'
> & {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm?: number;
};

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  private toPublicBusiness(
    business: Business,
    distanceKm?: number,
  ): PublicBusinessResponse {
    const hidesExactLocation = business.showOnlyDistance === true;

    return {
      id: business.id,
      name: business.name,
      description: business.description,
      type: business.type,
      address: hidesExactLocation ? null : business.address,
      latitude: hidesExactLocation ? null : business.latitude,
      longitude: hidesExactLocation ? null : business.longitude,
      photo: business.photo,
      category: business.category,
      categoryId: business.categoryId,
      schedule: business.schedule,
      instagram: business.instagram,
      facebook: business.facebook,
      isOpen: business.isOpen,
      showOnlyDistance: business.showOnlyDistance,
      userId: business.userId,
      ...(distanceKm === undefined ? {} : { distanceKm }),
    };
  }

  private applyPublicVisibility(
    query: SelectQueryBuilder<Business>,
  ): SelectQueryBuilder<Business> {
    return query
      .andWhere('business.status = :publicStatus', {
        publicStatus: 'approved',
      })
      .andWhere('length(btrim(business.name)) > 0')
      .andWhere("length(btrim(coalesce(business.description, ''))) > 0")
      .andWhere("length(btrim(coalesce(business.type, ''))) > 0")
      .andWhere("length(btrim(coalesce(business.photo, ''))) > 0")
      .andWhere("length(btrim(coalesce(business.category, ''))) > 0")
      .andWhere(`business.schedule ~ '"enabled"\\s*:\\s*true'`)
      .andWhere('business.categoryId IS NOT NULL')
      .andWhere('business.latitude IS NOT NULL')
      .andWhere('business.longitude IS NOT NULL')
      .andWhere('business.latitude <> 0')
      .andWhere('business.longitude <> 0')
      .andWhere(
        `EXISTS (
          SELECT 1
          FROM catalog_item public_catalog_item
          WHERE public_catalog_item."businessId" = business.id
            AND public_catalog_item."isActive" = true
        )`,
      );
  }

  private ensureCanManageBusiness(
    business: Business,
    currentUser?: CurrentUser,
  ) {
    if (currentUser?.role === 'admin' || business.userId === currentUser?.id) {
      return;
    }

    throw new ForbiddenException(
      'No tienes permiso para modificar este negocio',
    );
  }

  private async ensureCategoryExists(categoryId?: number): Promise<void> {
    if (categoryId === undefined) return;

    const categoryExists = await this.categoryRepository.existsBy({
      id: categoryId,
    });

    if (!categoryExists) {
      throw new BadRequestException('La categoría seleccionada no existe.');
    }
  }

  async create(data: Partial<Business>): Promise<Business> {
    await this.ensureCategoryExists(data.categoryId);

    const business = this.businessRepository.create(data);
    return this.businessRepository.save(business);
  }

  async findAll(): Promise<PublicBusinessResponse[]> {
    const businesses = await this.applyPublicVisibility(
      this.businessRepository.createQueryBuilder('business'),
    ).getMany();

    return businesses.map((business) => this.toPublicBusiness(business));
  }

  async findPending(): Promise<Business[]> {
    return this.businessRepository.find({ where: { status: 'pending' } });
  }

  async findByUserId(userId: number): Promise<Business[]> {
    return this.businessRepository.find({ where: { userId } });
  }

  async findOne(id: number): Promise<Business> {
    const business = await this.businessRepository.findOne({ where: { id } });

    if (!business) {
      throw new NotFoundException('Negocio no encontrado');
    }

    return business;
  }

  async findPublicOne(id: number): Promise<PublicBusinessResponse> {
    const business = await this.applyPublicVisibility(
      this.businessRepository.createQueryBuilder('business'),
    )
      .andWhere('business.id = :id', { id })
      .getOne();

    if (!business) {
      throw new NotFoundException('Negocio no encontrado');
    }

    return this.toPublicBusiness(business);
  }

  async update(
    id: number,
    data: Partial<Business>,
    currentUser?: CurrentUser,
  ): Promise<Business> {
    const business = await this.findOne(id);

    this.ensureCanManageBusiness(business, currentUser);
    await this.ensureCategoryExists(data.categoryId);

    await this.businessRepository.update(id, data);

    return this.findOne(id);
  }

  async remove(id: number, currentUser?: CurrentUser): Promise<void> {
    const business = await this.findOne(id);

    this.ensureCanManageBusiness(business, currentUser);

    await this.businessRepository.delete(id);
  }

  async approve(id: number): Promise<Business> {
    const business = await this.findOne(id);

    business.status = 'approved';

    return this.businessRepository.save(business);
  }

  async reject(id: number): Promise<Business> {
    const business = await this.findOne(id);

    business.status = 'rejected';

    return this.businessRepository.save(business);
  }

  async findNearby(
    lat: number,
    lng: number,
    radiusKm: number,
    categoryId?: number,
    search?: string,
  ): Promise<PublicBusinessResponse[]> {
    const distanceExpression =
      '(6371 * acos(cos(radians(:lat)) * cos(radians(business.latitude)) * cos(radians(business.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(business.latitude))))';
    const query = this.applyPublicVisibility(
      this.businessRepository.createQueryBuilder('business'),
    )
      .addSelect(distanceExpression, 'distanceKm')
      .andWhere(`${distanceExpression} < :radius`, {
        lat,
        lng,
        radius: radiusKm,
      })
      .orderBy(distanceExpression, 'ASC');

    if (categoryId) {
      query.andWhere('business.categoryId = :categoryId', { categoryId });
    }

    if (search) {
      query.andWhere(
        '(unaccent(LOWER(business.name)) LIKE unaccent(LOWER(:search)) OR unaccent(LOWER(business.keywords)) LIKE unaccent(LOWER(:search)) OR unaccent(LOWER(business.description)) LIKE unaccent(LOWER(:search)))',
        { search: `%${search}%` },
      );
    }

    const { entities, raw } = await query.getRawAndEntities();

    return entities.map((business, index) => {
      const distance = Number(raw[index]?.distanceKm);
      return this.toPublicBusiness(
        business,
        Number.isFinite(distance) ? distance : undefined,
      );
    });
  }
}
