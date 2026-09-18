import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class SavePushSubscriptionDto {
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  endpoint: string;

  @IsString()
  @MinLength(16)
  @MaxLength(512)
  p256dh: string;

  @IsString()
  @MinLength(8)
  @MaxLength(512)
  auth: string;
}
