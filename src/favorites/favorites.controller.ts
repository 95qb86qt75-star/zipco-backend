import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
@UseGuards(AuthGuard('jwt'))
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}
  @Get() findMine(@Request() req) {
    return this.favorites.findMine(req.user.id);
  }
  @Post() add(@Request() req, @Body() data: CreateFavoriteDto) {
    return this.favorites.add(req.user.id, data);
  }
  @Delete(':businessId') remove(
    @Request() req,
    @Param('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.favorites.remove(req.user.id, businessId);
  }
}
