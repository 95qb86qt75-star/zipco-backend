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

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(500)
  description: string;

  @IsEnum(CatalogItemKind)
  kind: CatalogItemKind;

  @IsEnum(CatalogItemPricingMode)
  pricingMode: CatalogItemPricingMode;

  @IsOptional()
  @IsInt()
  @Min(100)
  priceClp?: number | null;

  @IsOptional()
  @IsInt()
  @Min(100)
  startingPriceClp?: number | null;

  @IsString()
  @IsNotEmpty()
  @Matches(
    /^https:\/\/res\.cloudinary\.com\/[^/?#\s]+\/image\/upload\/[^\s]+$/i,
  )
  @MaxLength(2048)
  imageUrl: string;
}
