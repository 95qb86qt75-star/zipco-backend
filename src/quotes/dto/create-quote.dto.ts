import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateQuoteDto {
  @IsInt() @Min(1) businessId: number;
  @IsInt() @Min(1) catalogItemId: number;
  @IsString() @MaxLength(1000) message: string;
  @IsOptional() @IsBoolean() needNow?: boolean;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) requestedDate?:
    | string
    | null;
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  requestedTime?: string | null;
  @IsOptional() @IsString() @MaxLength(2048) referencePhoto?: string | null;
  @IsUUID() idempotencyKey: string;
}
