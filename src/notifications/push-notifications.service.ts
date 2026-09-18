import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webPush from 'web-push';
import { Order } from '../orders/order.entity';
import { SavePushSubscriptionDto } from './dto/save-push-subscription.dto';
import { PushSubscription } from './push-subscription.entity';

type WebPushError = Error & { statusCode?: number };

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? '';
  private readonly enabled: boolean;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptions: Repository<PushSubscription>,
  ) {
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? '';
    const subject = process.env.VAPID_SUBJECT?.trim() ?? '';
    this.enabled = Boolean(this.publicKey && privateKey && subject);

    if (this.enabled) {
      webPush.setVapidDetails(subject, this.publicKey, privateKey);
    } else {
      this.logger.warn('Web Push deshabilitado: falta configuracion VAPID');
    }
  }

  getPublicKey() {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Las notificaciones push no estan configuradas',
      );
    }

    return { publicKey: this.publicKey };
  }

  async save(userId: number, data: SavePushSubscriptionDto) {
    const existing = await this.subscriptions.findOne({
      where: { endpoint: data.endpoint },
    });
    const subscription = this.subscriptions.create({
      ...existing,
      ...data,
      userId,
    });
    await this.subscriptions.save(subscription);
    return { subscribed: true };
  }

  async remove(userId: number, endpoint: string) {
    await this.subscriptions.delete({ userId, endpoint });
    return { subscribed: false };
  }

  async notifyNewOrder(order: Order, ownerUserId: number): Promise<void> {
    if (!this.enabled) return;

    try {
      const targets = await this.subscriptions.find({
        where: { userId: ownerUserId },
      });
      if (targets.length === 0) return;

      const payload = JSON.stringify({
        type: 'new-order',
        title: 'Nuevo pedido recibido',
        body: `${order.customerName || 'Un cliente'} envio un pedido por $${Number(order.total).toLocaleString('es-CL')}`,
        tag: `order-${order.id}-created`,
        orderId: order.id,
        customerName: order.customerName,
        url: '/?open=requests-business',
      });

      await Promise.all(
        targets.map(async (target) => {
          try {
            await webPush.sendNotification(
              {
                endpoint: target.endpoint,
                keys: { p256dh: target.p256dh, auth: target.auth },
              },
              payload,
            );
          } catch (error) {
            const statusCode = (error as WebPushError).statusCode;
            if (statusCode === 404 || statusCode === 410) {
              await this.subscriptions.delete({ id: target.id });
              return;
            }
            this.logger.error(
              `No se pudo enviar la notificacion del pedido ${order.id}`,
            );
          }
        }),
      );
    } catch {
      this.logger.error(
        `No se pudieron procesar las notificaciones del pedido ${order.id}`,
      );
    }
  }
}
