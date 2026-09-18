import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushNotificationsController } from './push-notifications.controller';
import { PushSubscription } from './push-subscription.entity';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription])],
  controllers: [PushNotificationsController],
  providers: [PushNotificationsService],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
