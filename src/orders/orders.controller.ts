import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() data: Partial<Order>, @Request() req) {
    const userId = req.user?.id;
    return this.ordersService.create({ ...data, userId });
  }

  @Get('my-orders')
  @UseGuards(AuthGuard('jwt'))
  findMyOrders(@Request() req) {
    const userId = req.user?.id;
    return this.ordersService.findByUser(userId);
  }

  @Get('business/:businessId')
  @UseGuards(AuthGuard('jwt'))
  findByBusiness(@Param('businessId') businessId: number) {
    return this.ordersService.findByBusiness(businessId);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'))
  updateStatus(@Param('id') id: number, @Body('status') status: string) {
    return this.ordersService.updateStatus(id, status);
  }
}
