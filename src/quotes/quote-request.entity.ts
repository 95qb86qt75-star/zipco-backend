import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const QUOTE_STATUSES = [
  'requested',
  'quoted',
  'accepted',
  'declined',
  'cancelled',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

@Entity('quote_request')
@Index('UQ_quote_request_user_idempotency', ['userId', 'idempotencyKey'], {
  unique: true,
})
@Index('IDX_quote_request_business_created', ['businessId', 'createdAt'])
@Check(
  'CHK_quote_request_quoted_price',
  '"quotedPriceClp" IS NULL OR "quotedPriceClp" >= 100',
)
export class QuoteRequest {
  @PrimaryGeneratedColumn() id: number;
  @Column() businessId: number;
  @Column() catalogItemId: number;
  @Column() userId: number;
  @Column({ type: 'varchar', length: 120 }) customerName: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) customerPhone:
    | string
    | null;
  @Column({ type: 'varchar', length: 120 }) itemNameSnapshot: string;
  @Column({ type: 'varchar', length: 500 }) itemDescriptionSnapshot: string;
  @Column({ type: 'integer', nullable: true }) startingPriceClpSnapshot:
    | number
    | null;
  @Column({ type: 'varchar', length: 1000 }) message: string;
  @Column({ type: 'boolean', default: false }) needNow: boolean;
  @Column({ type: 'varchar', length: 10, nullable: true }) requestedDate:
    | string
    | null;
  @Column({ type: 'varchar', length: 5, nullable: true }) requestedTime:
    | string
    | null;
  @Column({ type: 'varchar', length: 2048, nullable: true }) referencePhoto:
    | string
    | null;
  @Column({ type: 'varchar', length: 20, default: 'requested' })
  status: QuoteStatus;
  @Column({ type: 'integer', nullable: true }) quotedPriceClp: number | null;
  @Column({ type: 'varchar', length: 1000, nullable: true }) businessMessage:
    | string
    | null;
  @Column({ type: 'uuid' }) idempotencyKey: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
