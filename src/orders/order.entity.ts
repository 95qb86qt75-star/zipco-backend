import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  businessId: number;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 20, default: 'product' })
  orderType: 'product' | 'service';

  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerPhone: string | null;

  @Column('text')
  products: string;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({ default: false })
  needNow: boolean;

  @Column({ type: 'varchar', nullable: true })
  deliveryDate: string | null;

  @Column({ type: 'varchar', nullable: true })
  deliveryTime: string | null;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'varchar', nullable: true })
  referencePhoto: string | null;

  @Column({ default: 'pending' })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  cancellationReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  cancellationReasonDetail: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true }) alternativeDate: string | null;
  @Column({ type: 'varchar', length: 5, nullable: true }) alternativeTime: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) alternativeItem: string | null;
  @Column({ type: 'integer', nullable: true }) alternativeQuantity: number | null;
  @Column({ type: 'integer', nullable: true }) alternativePriceClp: number | null;
  @Column({ type: 'varchar', length: 1000, nullable: true }) alternativeMessage: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  customerArchivedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  businessArchivedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  customerDeletedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  businessDeletedAt: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
