import { IsBoolean } from 'class-validator';

export class ArchiveRequestDto {
  @IsBoolean()
  archived: boolean;
}
