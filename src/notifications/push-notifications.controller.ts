import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RemovePushSubscriptionDto } from './dto/remove-push-subscription.dto';
import { SavePushSubscriptionDto } from './dto/save-push-subscription.dto';
import { PushNotificationsService } from './push-notifications.service';

@Controller('push')
export class PushNotificationsController {
  constructor(private readonly notifications: PushNotificationsService) {}

  @Get('public-key')
  getPublicKey() {
    return this.notifications.getPublicKey();
  }

  @Post('subscriptions')
  @UseGuards(AuthGuard('jwt'))
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  save(@Body() data: SavePushSubscriptionDto, @Request() req) {
    return this.notifications.save(req.user.id, data);
  }

  @Delete('subscriptions')
  @UseGuards(AuthGuard('jwt'))
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  remove(@Body() data: RemovePushSubscriptionDto, @Request() req) {
    return this.notifications.remove(req.user.id, data.endpoint);
  }
}
