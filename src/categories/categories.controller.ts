import { Controller, Get, Post, Body } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './category.entity';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Post()
  create(@Body() data: Partial<Category>) {
    return this.categoriesService.create(data);
  }

  @Post('seed')
  seed() {
    return this.categoriesService.seedCategories();
  }
}