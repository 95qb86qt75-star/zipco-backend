import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../businesses/business.entity';
import { Favorite } from './favorite.entity';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, Business])],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
