import { IsDefined, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CANCELLATION_REASONS, ORDER_STATUSES, REJECTION_REASONS } from '../order-status';
import type { CancellationReason, OrderStatus, RejectionReason } from '../order-status';

export class UpdateOrderStatusDto {
  @IsDefined()
  @IsIn(ORDER_STATUSES)
  status: OrderStatus;

  @ValidateIf((dto: UpdateOrderStatusDto) => dto.status === 'cancelled')
  @IsDefined()
  @IsIn(CANCELLATION_REASONS)
  cancellationReason?: CancellationReason;

  @ValidateIf((dto: UpdateOrderStatusDto) => dto.status === 'rejected')
  @IsDefined()
  @IsIn(REJECTION_REASONS)
  rejectionReason?: RejectionReason;

  @ValidateIf((dto: UpdateOrderStatusDto) => dto.cancellationReason === 'other' || dto.rejectionReason === 'other')
  @IsDefined()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reasonDetail?: string;
}
