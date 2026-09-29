import { IsBoolean, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdatePushPresenceDto {
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  endpoint: string;

  @IsBoolean()
  isForeground: boolean;
}
