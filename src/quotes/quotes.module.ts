import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { QuoteRequest } from './quote-request.entity';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [TypeOrmModule.forFeature([QuoteRequest]), UsersModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
