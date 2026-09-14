import { IsBoolean } from 'class-validator';

export class UpdateCatalogItemStatusDto {
  @IsBoolean()
  isActive: boolean;
}
