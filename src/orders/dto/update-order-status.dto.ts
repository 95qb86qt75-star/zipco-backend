import { IsDefined, IsIn, ValidateIf } from 'class-validator';
import { CANCELLATION_REASONS, ORDER_STATUSES } from '../order-status';
import type { CancellationReason, OrderStatus } from '../order-status';

export class UpdateOrderStatusDto {
  @IsDefined()
  @IsIn(ORDER_STATUSES)
  status: OrderStatus;

  @ValidateIf((dto: UpdateOrderStatusDto) => dto.status === 'cancelled')
  @IsDefined()
  @IsIn(CANCELLATION_REASONS)
  cancellationReason?: CancellationReason;
}
