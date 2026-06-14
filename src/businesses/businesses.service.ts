import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from './business.entity';

@Injectable()
export class BusinessesService implements OnModuleInit {
  constructor(
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
  ) {}

  async onModuleInit() {
    await this.businessRepository.query('CREATE EXTENSION IF NOT EXISTS unaccent');
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

  async findOne(id: number): Promise<Business | null> {
    return this.businessRepository.findOne({ where: { id: id } });
  }

  async update(id: number, data: Partial<Business>): Promise<Business | null> {
    await this.businessRepository.update(id, data);
    return this.businessRepository.findOne({ where: { id: id } });
  }

  async remove(id: number): Promise<void> {
    await this.businessRepository.delete(id);
  }

  async approve(id: number): Promise<Business | null> {
    await this.businessRepository.update(id, { status: 'approved' });
    return this.businessRepository.findOne({ where: { id: id } });
  }

  async reject(id: number): Promise<Business | null> {
    await this.businessRepository.update(id, { status: 'rejected' });
    return this.businessRepository.findOne({ where: { id: id } });
  }

  async findNearby(lat: number, lng: number, radiusKm: number, categoryId?: number, search?: string): Promise<Business[]> {
    const query = this.businessRepository
      .createQueryBuilder('business')
      .where('business.status = :status', { status: 'approved' })
      .andWhere(
        '(6371 * acos(cos(radians(:lat)) * cos(radians(business.latitude)) * cos(radians(business.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(business.latitude)))) < :radius',
        { lat, lng, radius: radiusKm }
      )
      .orderBy(
        '(6371 * acos(cos(radians(:lat)) * cos(radians(business.latitude)) * cos(radians(business.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(business.latitude))))',
        'ASC'
      );

    if (categoryId) {
      query.andWhere('business.categoryId = :categoryId', { categoryId });
    }

    if (search) {
      query.andWhere(
        '(unaccent(LOWER(business.name)) LIKE unaccent(LOWER(:search)) OR unaccent(LOWER(business.keywords)) LIKE unaccent(LOWER(:search)) OR unaccent(LOWER(business.description)) LIKE unaccent(LOWER(:search)))',
        { search: `%${search}%` }
      );
    }

    return query.getMany();
  }
}
