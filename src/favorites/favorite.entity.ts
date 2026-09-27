import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('favorite')
@Index('UQ_favorite_user_business', ['userId', 'businessId'], { unique: true })
export class Favorite {
  @PrimaryGeneratedColumn() id: number;
  @Column() userId: number;
  @Column() businessId: number;
  @Column({ type: 'varchar', length: 20, default: 'business' }) kind:
    | 'business'
    | 'service';
  @CreateDateColumn() createdAt: Date;
}
