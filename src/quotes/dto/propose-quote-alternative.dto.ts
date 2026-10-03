import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ProposeQuoteAlternativeDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time?: string;
  @IsOptional() @IsString() @MaxLength(120) item?: string;
  @IsOptional() @IsInt() @Min(1) @Max(999) quantity?: number;
  @IsOptional() @IsInt() @Min(100) @Max(2_147_483_647) priceClp?: number;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  photo?: string;
  @IsString() @MinLength(3) @MaxLength(1000) message: string;
}
