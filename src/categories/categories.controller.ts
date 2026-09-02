import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CategoriesService } from './categories.service';
import { Category } from './category.entity';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  private ensureIsAdmin(currentUser?: { role?: string }) {
    if (currentUser?.role === 'admin') {
      return;
    }

    throw new ForbiddenException(
      'No tienes permiso para administrar categorías',
    );
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() data: Partial<Category>, @Request() req) {
    this.ensureIsAdmin(req.user);

    return this.categoriesService.create(data);
  }

  @Post('seed')
  @UseGuards(AuthGuard('jwt'))
  seed(@Request() req) {
    this.ensureIsAdmin(req.user);

    return this.categoriesService.seedCategories();
  }
}
