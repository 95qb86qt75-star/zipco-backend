import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_creation_attempt')
@Unique('UQ_order_creation_attempt_user_key', ['userId', 'idempotencyKey'])
@Unique('UQ_order_creation_attempt_order', ['orderId'])
export class OrderCreationAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 64 })
  idempotencyKey: string;

  @Column({ type: 'char', length: 64 })
  requestHash: string;

  @Column()
  orderId: number;

  @ManyToOne(() => Order, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @CreateDateColumn()
  createdAt: Date;
}
