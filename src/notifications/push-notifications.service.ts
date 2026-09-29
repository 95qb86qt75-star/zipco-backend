import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webPush from 'web-push';
import { Order } from '../orders/order.entity';
import { QuoteRequest, QuoteStatus } from '../quotes/quote-request.entity';
import { SavePushSubscriptionDto } from './dto/save-push-subscription.dto';
import { UpdatePushPresenceDto } from './dto/update-push-presence.dto';
import { PushSubscription } from './push-subscription.entity';

type WebPushError = Error & { statusCode?: number };
const FOREGROUND_STALE_MS = 12_000;
const FOREGROUND_RETRY_MS = 13_000;

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

  async updatePresence(userId: number, data: UpdatePushPresenceDto) {
    await this.subscriptions.update(
      { userId, endpoint: data.endpoint },
      { isForeground: data.isForeground, lastSeenAt: new Date() },
    );
    return { updated: true };
  }

  async notifyNewOrder(order: Order, ownerUserId: number): Promise<void> {
    await this.sendToUser(ownerUserId, {
      type: 'new-order',
      title: 'Nuevo pedido recibido',
      body: `${order.customerName || 'Un cliente'} envio un pedido por $${Number(order.total).toLocaleString('es-CL')}`,
      tag: `order-${order.id}-created`,
      orderId: order.id,
      customerName: order.customerName,
      url: '/?open=requests-business',
    });
  }

  async notifyNewQuote(
    quote: QuoteRequest,
    ownerUserId: number,
  ): Promise<void> {
    await this.sendToUser(ownerUserId, {
      type: 'new-quote',
      title: 'Nueva cotizacion recibida',
      body: `${quote.customerName || 'Un cliente'} solicito una cotizacion por ${quote.itemNameSnapshot}`,
      tag: `quote-${quote.id}-created`,
      quoteId: quote.id,
      customerName: quote.customerName,
      url: '/?open=requests-business-quotes',
    });
  }

  async notifyOrderStatusChanged(
    order: Order,
    recipientUserId: number,
    status: 'accepted' | 'rejected' | 'cancelled' | 'ready' | 'completed',
  ): Promise<void> {
    const copy = {
      accepted: ['Pedido aceptado', 'El negocio acepto tu pedido.'],
      rejected: ['Pedido rechazado', 'El negocio rechazo tu pedido.'],
      cancelled: ['Pedido cancelado', `${order.customerName || 'El cliente'} cancelo el pedido.`],
      ready: ['Tu pedido esta listo', 'El negocio marco tu pedido como listo.'],
      completed: ['Pedido completado', 'El pedido fue marcado como completado.'],
    } as const;
    const [title, body] = copy[status];
    await this.sendToUser(recipientUserId, {
      type: `order-${status}`,
      title,
      body,
      tag: `order-${order.id}-${status}`,
      orderId: order.id,
      url: '/?open=requests-customer',
    });
  }

  async notifyQuoteResponded(quote: QuoteRequest): Promise<void> {
    await this.sendToUser(quote.userId, {
      type: 'quote-responded',
      title: 'Respondieron tu cotizacion',
      body: `Recibiste un precio para ${quote.itemNameSnapshot}`,
      tag: `quote-${quote.id}-responded`,
      quoteId: quote.id,
      url: '/?open=requests-customer-quotes',
    });
  }

  async notifyQuoteStatusChanged(
    quote: QuoteRequest,
    ownerUserId: number,
    status: Extract<QuoteStatus, 'accepted' | 'declined' | 'cancelled'>,
  ): Promise<void> {
    const copy = {
      accepted: [
        'Cotizacion aceptada',
        `El cliente acepto tu cotizacion por ${quote.itemNameSnapshot}`,
      ],
      declined: [
        'Cotizacion rechazada',
        `El cliente rechazo tu cotizacion por ${quote.itemNameSnapshot}`,
      ],
      cancelled: [
        'Cotizacion cancelada',
        `El cliente cancelo su solicitud por ${quote.itemNameSnapshot}`,
      ],
    } as const;
    const [title, body] = copy[status];
    await this.sendToUser(ownerUserId, {
      type: `quote-${status}`,
      title,
      body,
      tag: `quote-${quote.id}-${status}`,
      quoteId: quote.id,
      url: '/?open=requests-business-quotes',
    });
  }

  private async sendToUser(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const targets = await this.subscriptions.find({
        where: { userId },
      });
      const eligibleTargets = targets.filter((target) =>
        this.canReceiveSystemPush(target),
      );
      const deferredTargets = targets.filter(
        (target) => !this.canReceiveSystemPush(target),
      );
      await this.sendToTargets(eligibleTargets, payload);
      deferredTargets.forEach((target) => {
        const timeout = setTimeout(() => {
          void this.retryDeferredTarget(userId, target.endpoint, payload);
        }, FOREGROUND_RETRY_MS);
        timeout.unref?.();
      });
    } catch {
      this.logger.error(
        `No se pudieron procesar las notificaciones ${String(payload.tag ?? '')}`,
      );
    }
  }

  private canReceiveSystemPush(target: PushSubscription): boolean {
    return (
      !target.isForeground ||
      !target.lastSeenAt ||
      target.lastSeenAt.getTime() < Date.now() - FOREGROUND_STALE_MS
    );
  }

  private async retryDeferredTarget(
    userId: number,
    endpoint: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const target = await this.subscriptions.findOne({
      where: { userId, endpoint },
    });
    if (!target || !this.canReceiveSystemPush(target)) return;
    await this.sendToTargets([target], payload);
  }

  private async sendToTargets(
    targets: PushSubscription[],
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (targets.length === 0) return;
    const serializedPayload = JSON.stringify(payload);
    await Promise.all(
      targets.map(async (target) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: target.endpoint,
              keys: { p256dh: target.p256dh, auth: target.auth },
            },
            serializedPayload,
          );
        } catch (error) {
          const statusCode = (error as WebPushError).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.subscriptions.delete({ id: target.id });
            return;
          }
          this.logger.error(
            `No se pudo enviar la notificacion ${String(payload.tag ?? '')}`,
          );
        }
      }),
    );
  }
}
