import {
  BadRequestException,
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

  private parseFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }

    if (
      typeof value === 'string' &&
      (value.trim() === '' || value.trim().toLowerCase() === 'null')
    ) {
      return null;
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  private selectEditableFields(
    data: CreateBusinessDto | UpdateBusinessDto | undefined,
  ): Partial<Business> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException(
        'El cuerpo de la solicitud es obligatorio y debe ser JSON válido',
      );
    }

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
    @Query('lat') lat: unknown,
    @Query('lng') lng: unknown,
    @Query('radius') radius: unknown,
    @Query('categoryId') categoryId?: number,
    @Query('search') search?: string,
  ) {
    const parsedLat = this.parseFiniteNumber(lat);
    const parsedLng = this.parseFiniteNumber(lng);
    const parsedRadius = this.parseFiniteNumber(radius);

    if (
      parsedLat === null ||
      parsedLng === null ||
      parsedLat < -90 ||
      parsedLat > 90 ||
      parsedLng < -180 ||
      parsedLng > 180
    ) {
      throw new BadRequestException('Ubicación inválida');
    }

    if (parsedRadius === null || parsedRadius <= 0) {
      throw new BadRequestException('Radio de búsqueda inválido');
    }

    return this.businessesService.findNearby(
      parsedLat,
      parsedLng,
      parsedRadius,
      categoryId,
      search,
    );
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
