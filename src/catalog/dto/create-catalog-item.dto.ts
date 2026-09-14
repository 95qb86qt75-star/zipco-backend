import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CatalogItemKind,
  CatalogItemPricingMode,
} from '../catalog-item.entity';

export class CreateCatalogItemDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsEnum(CatalogItemKind)
  kind: CatalogItemKind;

  @IsEnum(CatalogItemPricingMode)
  pricingMode: CatalogItemPricingMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceClp?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  startingPriceClp?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string | null;
}
