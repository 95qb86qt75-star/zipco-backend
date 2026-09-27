import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RespondQuoteDto {
  @IsInt() @Min(100) priceClp: number;
  @IsOptional() @IsString() @MaxLength(1000) message?: string | null;
}
