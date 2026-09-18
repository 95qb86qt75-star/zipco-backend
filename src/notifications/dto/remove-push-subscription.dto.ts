import { IsUrl, MaxLength } from 'class-validator';

export class RemovePushSubscriptionDto {
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  endpoint: string;
}
