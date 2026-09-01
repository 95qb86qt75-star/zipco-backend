import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Business } from './businesses/business.entity';
import { Category } from './categories/category.entity';
import { Order } from './orders/order.entity';
import { User } from './users/user.entity';
import { BusinessesModule } from './businesses/businesses.module';
import { CategoriesModule } from './categories/categories.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { VerificationCode } from './auth/verification-code.entity';
import { OrdersModule } from './orders/orders.module';
import { getDatabaseUrl } from './database-url';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: getDatabaseUrl(),
      entities: [Business, Category, Order, User, VerificationCode],
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
