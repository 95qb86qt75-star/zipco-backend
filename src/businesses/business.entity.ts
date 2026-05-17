import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'; 

@Entity()
export class Business {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  address: string;

  @Column('decimal', { precision: 10, scale: 7 })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 7 })
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
  instagram: string;

  @Column({ nullable: true })
  facebook: string;

  @Column({ default: false })
  showOnlyDistance: boolean;

  @Column({ default: 'pending' })
  status: string;

  @Column()
  categoryId: number;

  @Column()
  userId: number;

  @CreateDateColumn()
  createdAt: Date;
}