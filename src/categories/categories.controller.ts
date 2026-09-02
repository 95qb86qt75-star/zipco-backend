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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { CategoriesService } from './categories.service';
import { Category } from './category.entity';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async ensureIsAdmin(userId?: number) {
    if (!userId) {
      throw new ForbiddenException(
        'No tienes permiso para administrar categorías',
      );
    }

    const currentUser = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, role: true },
    });

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
  async create(@Body() data: Partial<Category>, @Request() req) {
    await this.ensureIsAdmin(req.user?.id);

    return this.categoriesService.create(data);
  }

  @Post('seed')
  @UseGuards(AuthGuard('jwt'))
  async seed(@Request() req) {
    await this.ensureIsAdmin(req.user?.id);

    return this.categoriesService.seedCategories();
  }
}
