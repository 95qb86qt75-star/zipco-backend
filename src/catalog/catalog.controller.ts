import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CatalogService } from './catalog.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { ReorderCatalogItemsDto } from './dto/reorder-catalog-items.dto';
import { UpdateCatalogItemStatusDto } from './dto/update-catalog-item-status.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';

@Controller('businesses/:businessId/catalog-items')
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  findPublic(@Param('businessId', ParseIntPipe) businessId: number) {
    return this.catalogService.findPublic(businessId);
  }

  @Get('manage')
  @UseGuards(AuthGuard('jwt'))
  findManaged(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Request() req,
  ) {
    return this.catalogService.findManaged(businessId, req.user);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Body() data: CreateCatalogItemDto,
    @Request() req,
  ) {
    return this.catalogService.create(businessId, data, req.user);
  }

  @Patch(':itemId/status')
  @UseGuards(AuthGuard('jwt'))
  updateStatus(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() data: UpdateCatalogItemStatusDto,
    @Request() req,
  ) {
    return this.catalogService.updateStatus(
      businessId,
      itemId,
      data.isActive,
      req.user,
    );
  }

  @Patch(':itemId')
  @UseGuards(AuthGuard('jwt'))
  update(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() data: UpdateCatalogItemDto,
    @Request() req,
  ) {
    return this.catalogService.update(businessId, itemId, data, req.user);
  }

  @Put('order')
  @UseGuards(AuthGuard('jwt'))
  reorder(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Body() data: ReorderCatalogItemsDto,
    @Request() req,
  ) {
    return this.catalogService.reorder(businessId, data.itemIds, req.user);
  }
}
