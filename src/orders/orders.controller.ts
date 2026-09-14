import {
  Body,
  Controller,
  Get,
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
  create(@Body() data: CreateOrderDto, @Request() req) {
    return this.ordersService.create(data, req.user?.id);
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
    const { status, cancellationReason } = data;

    return this.ordersService.updateStatus(
      id,
      { status, cancellationReason },
      req.user,
    );
  }
}
