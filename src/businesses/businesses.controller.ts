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
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  private selectEditableFields(
    data: CreateBusinessDto | UpdateBusinessDto,
  ): Partial<Business> {
    const safeData: Partial<Business> = {};

    if (data.name !== undefined) safeData.name = data.name;
    if (data.description !== undefined) safeData.description = data.description;
    if (data.type !== undefined) safeData.type = data.type;
    if (data.address !== undefined) safeData.address = data.address;
    if (data.latitude !== undefined) safeData.latitude = data.latitude;
    if (data.longitude !== undefined) safeData.longitude = data.longitude;
    if (data.phone !== undefined) safeData.phone = data.phone;
    if (data.email !== undefined) safeData.email = data.email;
    if (data.photo !== undefined) safeData.photo = data.photo;
    if (data.keywords !== undefined) safeData.keywords = data.keywords;
    if (data.category !== undefined) safeData.category = data.category;
    if (data.categoryId !== undefined) safeData.categoryId = data.categoryId;
    if (data.schedule !== undefined) safeData.schedule = data.schedule;
    if (data.instagram !== undefined) safeData.instagram = data.instagram;
    if (data.facebook !== undefined) safeData.facebook = data.facebook;
    if (data.products !== undefined) safeData.products = data.products;
    if (data.isOpen !== undefined) safeData.isOpen = data.isOpen;
    if (data.showOnlyDistance !== undefined) {
      safeData.showOnlyDistance = data.showOnlyDistance;
    }

    return safeData;
  }

  private ensureIsAdmin(currentUser?: { role?: string }) {
    if (currentUser?.role === 'admin') {
      return;
    }

    throw new ForbiddenException('No tienes permiso para administrar negocios');
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() data: CreateBusinessDto, @Request() req) {
    const userId = req.user?.id;
    const safeData = this.selectEditableFields(data);

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
    @Body() data: UpdateBusinessDto,
    @Request() req,
  ) {
    const safeData = this.selectEditableFields(data);

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
