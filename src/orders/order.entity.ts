import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
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

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;
}
