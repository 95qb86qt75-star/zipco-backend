import { IsIn, IsInt, Min } from 'class-validator';

export class CreateFavoriteDto {
  @IsInt() @Min(1) businessId: number;
  @IsIn(['business', 'service']) kind: 'business' | 'service';
}
