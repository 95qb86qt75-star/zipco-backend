import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BusinessesService } from './businesses.service';
import { Business } from './business.entity';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  private ensureIsAdmin(currentUser?: { role?: string }) {
    if (currentUser?.role === 'admin') {
      return;
    }

    throw new ForbiddenException('No tienes permiso para administrar negocios');
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() data: Partial<Business>, @Request() req) {
    const userId = req.user?.id;
    const { status, userId: _ignoredUserId, ...safeData } = data;

    return this.businessesService.create({ ...safeData, userId });
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

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  findMine(@Request() req) {
    return this.businessesService.findByUserId(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.businessesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<Business>,
    @Request() req,
  ) {
    const { status, userId, categoryId, ...safeData } = data;

    return this.businessesService.update(id, safeData, req.user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.businessesService.remove(id, req.user);
  }

  @Patch(':id/approve')
  @UseGuards(AuthGuard('jwt'))
  approve(@Param('id', ParseIntPipe) id: number, @Request() req) {
    this.ensureIsAdmin(req.user);

    return this.businessesService.approve(id);
  }

  @Patch(':id/reject')
  @UseGuards(AuthGuard('jwt'))
  reject(@Param('id', ParseIntPipe) id: number, @Request() req) {
    this.ensureIsAdmin(req.user);

    return this.businessesService.reject(id);
  }
}
