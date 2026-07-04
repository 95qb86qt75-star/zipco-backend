import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from './business.entity';

type CurrentUser = {
  id?: number;
  role?: string;
};

@Injectable()
export class BusinessesService implements OnModuleInit {
  constructor(
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
  ) {}

  async onModuleInit() {
    await this.businessRepository.query('CREATE EXTENSION IF NOT EXISTS unaccent');
  }

  private ensureCanManageBusiness(business: Business, currentUser?: CurrentUser) {
    if (currentUser?.role === 'admin' || business.userId === currentUser?.id) {
      return;
    }

    throw new ForbiddenException('No tienes permiso para modificar este negocio');
  }

  async create(data: Partial<Business>): Promise<Business> {
    const business = this.businessRepository.create(data);
    return this.businessRepository.save(business);
  }

  async findAll(): Promise<Business[]> {
    return this.businessRepository.find();
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

  async update(
    id: number,
    data: Partial<Business>,
    currentUser?: CurrentUser,
  ): Promise<Business> {
    const business = await this.findOne(id);

    this.ensureCanManageBusiness(business, currentUser);

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
  ): Promise<Business[]> {
    const query = this.businessRepository
      .createQueryBuilder('business')
      .where('business.status = :status', { status: 'approved' })
      .andWhere(
        '(6371 * acos(cos(radians(:lat)) * cos(radians(business.latitude)) * cos(radians(business.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(business.latitude)))) < :radius',
        { lat, lng, radius: radiusKm },
      )
      .orderBy(
        '(6371 * acos(cos(radians(:lat)) * cos(radians(business.latitude)) * cos(radians(business.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(business.latitude))))',
        'ASC',
      );

    if (categoryId) {
      query.andWhere('business.categoryId = :categoryId', { categoryId });
    }

    if (search) {
      query.andWhere(
        '(unaccent(LOWER(business.name)) LIKE unaccent(LOWER(:search)) OR unaccent(LOWER(business.keywords)) LIKE unaccent(LOWER(:search)) OR unaccent(LOWER(business.description)) LIKE unaccent(LOWER(:search)))',
        { search: `%${search}%` },
      );
    }

    return query.getMany();
  }
}
