import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Order } from './order.entity';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ArchiveRequestDto } from '../common/dto/archive-request.dto';
import { ProposeOrderAlternativeDto } from './dto/propose-order-alternative.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  create(
    @Body() data: CreateOrderDto,
    @Request() req,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (
      !idempotencyKey ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idempotencyKey,
      )
    ) {
      throw new BadRequestException(
        'Se requiere una clave de reintento valida para crear el pedido',
      );
    }
    return this.ordersService.create(data, req.user?.id, idempotencyKey);
  }

  @Get('my-orders')
  @UseGuards(AuthGuard('jwt'))
  findMyOrders(@Request() req) {
    const userId = req.user?.id;
    return this.ordersService.findByUser(userId);
  }

  @Get('business/:businessId')
  @UseGuards(AuthGuard('jwt'))
  findByBusiness(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Request() req,
  ) {
    return this.ordersService.findByBusiness(businessId, req.user);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'))
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateOrderStatusDto,
    @Request() req,
  ) {
    const { status, cancellationReason, rejectionReason, reasonDetail } = data;
    return this.ordersService.updateStatus(id, {
      status,
      ...(cancellationReason ? { cancellationReason } : {}),
      ...(rejectionReason ? { rejectionReason } : {}),
      ...(reasonDetail ? { reasonDetail } : {}),
    }, req.user);
  }

  @Patch(':id/alternative')
  @UseGuards(AuthGuard('jwt'))
  proposeAlternative(@Param('id', ParseIntPipe) id: number, @Body() data: ProposeOrderAlternativeDto, @Request() req) {
    return this.ordersService.proposeAlternative(id, data, req.user);
  }

  @Patch(':id/archive')
  @UseGuards(AuthGuard('jwt'))
  archive(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: ArchiveRequestDto,
    @Request() req,
  ) {
    return this.ordersService.setArchived(id, data.archived, req.user);
  }

  @Patch(':id/delete-permanently')
  @UseGuards(AuthGuard('jwt'))
  deletePermanently(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.ordersService.setPermanentlyDeleted(id, req.user);
  }
}
