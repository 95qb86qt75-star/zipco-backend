import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Business } from './businesses/business.entity';
import { Category } from './categories/category.entity';
import { Order } from './orders/order.entity';
import { OrderItem } from './orders/order-item.entity';
import { OrderCreationAttempt } from './orders/order-creation-attempt.entity';
import { User } from './users/user.entity';
import { BusinessesModule } from './businesses/businesses.module';
import { CategoriesModule } from './categories/categories.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { VerificationCode } from './auth/verification-code.entity';
import { OrdersModule } from './orders/orders.module';
import { getDatabaseUrl } from './database-url';
import { DevAuthModule } from './dev/dev-auth.module';
import { CatalogItem } from './catalog/catalog-item.entity';
import { CatalogModule } from './catalog/catalog.module';
import { QaAuthModule } from './qa/qa-auth.module';
import { PushNotificationsModule } from './notifications/push-notifications.module';
import { PushSubscription } from './notifications/push-subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: getDatabaseUrl(),
      entities: [
        Business,
        CatalogItem,
        Category,
        Order,
        OrderItem,
        OrderCreationAttempt,
        PushSubscription,
        User,
        VerificationCode,
      ],
      synchronize: false,
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
    }),
    BusinessesModule,
    CategoriesModule,
    UsersModule,
    AuthModule,
    OrdersModule,
    CatalogModule,
    DevAuthModule.register(),
    QaAuthModule.register(),
    PushNotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
