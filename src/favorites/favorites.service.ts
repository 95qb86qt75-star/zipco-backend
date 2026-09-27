import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../businesses/business.entity';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { Favorite } from './favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favorites: Repository<Favorite>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
  ) {}

  async findMine(userId: number) {
    const records = await this.favorites.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const businessIds = records.map((record) => record.businessId);
    const businesses = businessIds.length
      ? await this.businesses
          .createQueryBuilder('business')
          .where('business.id IN (:...businessIds)', { businessIds })
          .andWhere('business.status = :status', { status: 'approved' })
          .getMany()
      : [];
    const byId = new Map(businesses.map((business) => [business.id, business]));
    return records.flatMap((record) => {
      const business = byId.get(record.businessId);
      return business ? [{ ...record, business }] : [];
    });
  }

  async add(userId: number, data: CreateFavoriteDto) {
    const business = await this.businesses.findOne({
      where: { id: data.businessId, status: 'approved' },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    const existing = await this.favorites.findOne({
      where: { userId, businessId: data.businessId },
    });
    if (existing) {
      if (existing.kind !== data.kind) {
        existing.kind = data.kind;
        return this.favorites.save(existing);
      }
      return existing;
    }
    return this.favorites.save(this.favorites.create({ userId, ...data }));
  }

  async remove(userId: number, businessId: number) {
    await this.favorites.delete({ userId, businessId });
    return { removed: true };
  }
}
