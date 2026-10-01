import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf, IsDefined } from 'class-validator';

export const QUOTE_CANCELLATION_REASONS = [
  'no_longer_needed',
  'sent_by_mistake',
  'requirements_changed',
  'business_took_too_long',
  'other',
] as const;
export type QuoteCancellationReason = (typeof QUOTE_CANCELLATION_REASONS)[number];

export class UpdateQuoteStatusDto {
  @IsIn(['accepted', 'declined', 'cancelled', 'ready', 'completed'])
  status: 'accepted' | 'declined' | 'cancelled' | 'ready' | 'completed';

  @ValidateIf((dto: UpdateQuoteStatusDto) => dto.status === 'cancelled')
  @IsDefined()
  @IsIn(QUOTE_CANCELLATION_REASONS)
  reason?: QuoteCancellationReason;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reasonDetail?: string;
}
