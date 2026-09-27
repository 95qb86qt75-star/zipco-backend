import { IsIn } from 'class-validator';

export class UpdateQuoteStatusDto {
  @IsIn(['accepted', 'declined', 'cancelled'])
  status: 'accepted' | 'declined' | 'cancelled';
}
