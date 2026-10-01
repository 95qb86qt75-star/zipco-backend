import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export const QUOTE_CANCELLATION_REASONS = [
  'no_longer_needed',
  'sent_by_mistake',
  'requirements_changed',
  'business_took_too_long',
  'unavailable',
  'cannot_meet_schedule',
  'outside_service_area',
  'insufficient_information',
  'no_capacity',
  'other',
] as const;
export type QuoteCancellationReason = (typeof QUOTE_CANCELLATION_REASONS)[number];

export class UpdateQuoteStatusDto {
  @IsIn(['accepted', 'declined', 'cancelled', 'ready', 'completed'])
  status: 'accepted' | 'declined' | 'cancelled' | 'ready' | 'completed';

  @ValidateIf((dto: UpdateQuoteStatusDto) => dto.reason !== undefined)
  @IsIn(QUOTE_CANCELLATION_REASONS)
  reason?: QuoteCancellationReason;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reasonDetail?: string;
}
