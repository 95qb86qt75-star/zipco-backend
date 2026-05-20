import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'; 

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

  @CreateDateColumn()
  createdAt: Date;
}