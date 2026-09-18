import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
@Index(['userId'])
export class PushSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 2048, unique: true })
  endpoint: string;

  @Column({ type: 'varchar', length: 512 })
  p256dh: string;

  @Column({ type: 'varchar', length: 512 })
  auth: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
