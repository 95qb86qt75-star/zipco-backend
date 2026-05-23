import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { Business } from './business.entity';
import { AuthGuard } from '@nestjs/passport';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() data: Partial<Business>, @Request() req) {
    const userId = req.user?.id;
    return this.businessesService.create({ ...data, userId });
  }

  @Get()
  findAll() {
    return this.businessesService.findAll();
  }

  @Get('pending')
  findPending() {
    return this.businessesService.findPending();
  }

  @Get('nearby')
  findNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number,
    @Query('categoryId') categoryId?: number,
    @Query('search') search?: string,
  ) {
    return this.businessesService.findNearby(lat, lng, radius, categoryId, search);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.businessesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: number, @Body() data: Partial<Business>, @Request() req) {
    return this.businessesService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: number) {
    return this.businessesService.remove(id);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: number) {
    return this.businessesService.approve(id);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: number) {
    return this.businessesService.reject(id);
  }
}