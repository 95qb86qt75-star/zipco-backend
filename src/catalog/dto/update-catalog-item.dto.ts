import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CatalogItemKind,
  CatalogItemPricingMode,
} from '../catalog-item.entity';

export class UpdateCatalogItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(120)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(CatalogItemKind)
  kind?: CatalogItemKind;

  @IsOptional()
  @IsEnum(CatalogItemPricingMode)
  pricingMode?: CatalogItemPricingMode;

  @IsOptional()
  @IsInt()
  @Min(100)
  priceClp?: number | null;

  @IsOptional()
  @IsInt()
  @Min(100)
  startingPriceClp?: number | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^https:\/\/res\.cloudinary\.com\/[^/?#\s]+\/image\/upload\/[^\s]+$/i,
  )
  @MaxLength(2048)
  imageUrl?: string;
}
