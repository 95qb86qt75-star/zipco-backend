import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { CatalogItem } from '../catalog/catalog-item.entity';
import { UsersModule } from '../users/users.module';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderCreationAttempt } from './order-creation-attempt.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PushNotificationsModule } from '../notifications/push-notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderCreationAttempt,
      CatalogItem,
    ]),
    BusinessesModule,
    UsersModule,
    PushNotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
