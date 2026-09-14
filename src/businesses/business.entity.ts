import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CatalogItem } from '../catalog/catalog-item.entity';

@Entity()
export class Business {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  address: string;

  @Column('decimal', { precision: 10, scale: 7, nullable: true, default: 0 })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 7, nullable: true, default: 0 })
  longitude: number;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  photo: string;

  @Column({ nullable: true })
  keywords: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  schedule: string;

  @Column({ nullable: true })
  instagram: string;

  @Column({ nullable: true })
  facebook: string;

  @Column({ nullable: true })
  products: string;

  @Column({ default: true })
  isOpen: boolean;

  @Column({ default: false })
  showOnlyDistance: boolean;

  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  categoryId: number;

  @Column()
  userId: number;

  @OneToMany(() => CatalogItem, (catalogItem) => catalogItem.business)
  catalogItems: CatalogItem[];

  @CreateDateColumn()
  createdAt: Date;
}
