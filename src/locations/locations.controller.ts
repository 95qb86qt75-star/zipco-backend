import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('suggestions')
  suggest(@Query('q') rawQuery?: string) {
    const query = rawQuery?.trim() ?? '';
    if (query.length < 3 || query.length > 120) {
      throw new BadRequestException(
        'La ubicación debe tener entre 3 y 120 caracteres',
      );
    }
    return this.locationsService.suggest(query);
  }
}
