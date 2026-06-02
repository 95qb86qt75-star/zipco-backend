import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  businessId: number;

  @Column()
  userId: number;

  @Column('text')
  products: string;

  @Column({ nullable: true })
  note: string;

  @Column({ default: false })
  needNow: boolean;

  @Column({ nullable: true })
  deliveryDate: string;

  @Column({ nullable: true })
  deliveryTime: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total: number;

  @Column({ default: 'pending' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
