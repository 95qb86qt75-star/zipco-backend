import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import {
  CatalogItem,
  CatalogItemKind,
  CatalogItemPricingMode,
} from '../catalog/catalog-item.entity';
import { Business } from '../businesses/business.entity';
import { BusinessesService } from '../businesses/businesses.service';
import { UsersService } from '../users/users.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderCreationAttempt } from './order-creation-attempt.entity';
import { PushNotificationsService } from '../notifications/push-notifications.service';
import {
  CANCELLATION_REASONS,
  CancellationReason,
  ORDER_STATUSES,
  OrderStatus,
} from './order-status';

type CurrentUser = {
  id?: number;
  role?: string;
};

type OrderActor = 'customer' | 'business' | 'admin';

const ALLOWED_TRANSITIONS: Record<
  OrderStatus,
  Partial<Record<OrderStatus, OrderActor[]>>
> = {
  pending: {
    accepted: ['business', 'admin'],
    rejected: ['business', 'admin'],
    cancelled: ['customer'],
  },
  accepted: {
    ready: ['business'],
  },
  ready: {
    completed: ['customer', 'business'],
  },
  rejected: {},
  cancelled: {},
  completed: {},
};

const MAX_ORDER_LINE_SUBTOTAL_CLP = 2_147_483_647;
const MAX_ORDER_TOTAL_CLP = 9_999_999_999;
const MAX_ORDER_ITEMS = 20;
const MAX_ORDER_ITEM_QUANTITY = 99;
const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_UNIQUE_CONSTRAINT = 'UQ_order_creation_attempt_user_key';

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function hasValidDeliverySelection(data: CreateOrderDto): boolean {
  if (typeof data.needNow !== 'boolean') return false;
  if (data.needNow) {
    return data.deliveryDate == null && data.deliveryTime == null;
  }
  return (
    typeof data.deliveryDate === 'string' &&
    isValidCalendarDate(data.deliveryDate) &&
    typeof data.deliveryTime === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(data.deliveryTime)
  );
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private businessesService: BusinessesService,
    private usersService: UsersService,
    private dataSource: DataSource,
    @Optional()
    private pushNotifications?: PushNotificationsService,
  ) {}

  private requestHash(data: CreateOrderDto): string {
    const canonicalPayload = {
      businessId: data.businessId,
      items: [...data.items]
        .map(({ catalogItemId, quantity }) => ({ catalogItemId, quantity }))
        .sort((left, right) => left.catalogItemId - right.catalogItemId),
      note: data.note ?? null,
      needNow: data.needNow ?? false,
      deliveryDate: data.deliveryDate ?? null,
      deliveryTime: data.deliveryTime ?? null,
      referencePhoto: data.referencePhoto ?? null,
    };

    return createHash('sha256')
      .update(JSON.stringify(canonicalPayload))
      .digest('hex');
  }

  private async findIdempotentOrder(
    userId: number,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<Order | null> {
    const attempt = await this.dataSource
      .getRepository(OrderCreationAttempt)
      .findOne({
        where: { userId, idempotencyKey },
        relations: { order: { items: true } },
      });

    if (!attempt) return null;
    if (attempt.requestHash !== requestHash) {
      throw new ConflictException(
        'La clave de reintento ya fue usada para un pedido diferente',
      );
    }

    return attempt.order;
  }

  private isIdempotencyRace(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as
      | { code?: string; constraint?: string }
      | undefined;
    return (
      driverError?.code === '23505' &&
      driverError.constraint === IDEMPOTENCY_UNIQUE_CONSTRAINT
    );
  }

  private async findOne(id: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    return order;
  }

  private async ensureCanAccessBusinessOrders(
    businessId: number,
    currentUser?: CurrentUser,
  ) {
    const business = await this.businessesService.findOne(businessId);

    if (currentUser?.role === 'admin' || business.userId === currentUser?.id) {
      return;
    }

    throw new ForbiddenException(
      'No tienes permiso para ver los pedidos de este negocio',
    );
  }

  private isOrderStatus(status: string): status is OrderStatus {
    return ORDER_STATUSES.includes(status as OrderStatus);
  }

  private isCancellationReason(reason?: string): reason is CancellationReason {
    return CANCELLATION_REASONS.includes(reason as CancellationReason);
  }

  private async getOrderActors(
    order: Order,
    currentUser?: CurrentUser,
  ): Promise<OrderActor[]> {
    const business = await this.businessesService.findOne(order.businessId);
    const actors: OrderActor[] = [];

    if (order.userId === currentUser?.id) actors.push('customer');
    if (business.userId === currentUser?.id) actors.push('business');
    if (currentUser?.role === 'admin') actors.push('admin');

    if (actors.length === 0) {
      throw new ForbiddenException(
        'No tienes permiso para modificar este pedido',
      );
    }

    return actors;
  }

  private async validateStatusTransition(
    order: Order,
    newStatus: string,
    cancellationReason: string | undefined,
    currentUser?: CurrentUser,
  ): Promise<CancellationReason | undefined> {
    const actors = await this.getOrderActors(order, currentUser);

    if (!this.isOrderStatus(newStatus)) {
      throw new BadRequestException('El estado solicitado no es válido');
    }

    if (!this.isOrderStatus(order.status)) {
      throw new BadRequestException(
        `El pedido tiene un estado actual no válido: ${order.status}`,
      );
    }

    const allowedActors = ALLOWED_TRANSITIONS[order.status][newStatus];
    if (!allowedActors) {
      throw new BadRequestException(
        `Transición inválida de ${order.status} a ${newStatus}`,
      );
    }

    if (!actors.some((actor) => allowedActors.includes(actor))) {
      throw new ForbiddenException(
        'No tienes permiso para realizar esta acción',
      );
    }

    if (newStatus === 'cancelled') {
      if (!this.isCancellationReason(cancellationReason)) {
        throw new BadRequestException(
          'Debes indicar un motivo de cancelación válido',
        );
      }

      return cancellationReason;
    }

    return undefined;
  }

  async create(
    data: CreateOrderDto,
    userId?: number,
    idempotencyKey: string = randomUUID(),
  ): Promise<Order> {
    if (!Number.isInteger(userId) || (userId ?? 0) <= 0) {
      throw new UnauthorizedException('Sesion no valida');
    }

    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException(
        'Se requiere una clave de reintento valida para crear el pedido',
      );
    }

    if (
      !Number.isInteger(data.businessId) ||
      data.businessId <= 0 ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.length > MAX_ORDER_ITEMS ||
      data.items.some(
        (item) =>
          !Number.isInteger(item?.catalogItemId) ||
          item.catalogItemId <= 0 ||
          !Number.isInteger(item?.quantity) ||
          item.quantity < 1 ||
          item.quantity > MAX_ORDER_ITEM_QUANTITY,
      )
    ) {
      throw new BadRequestException('Los articulos del pedido no son validos');
    }

    const catalogItemIds = data.items.map((item) => item.catalogItemId);
    if (new Set(catalogItemIds).size !== catalogItemIds.length) {
      throw new BadRequestException(
        'Cada articulo puede aparecer una sola vez en el pedido',
      );
    }

    const requestHash = this.requestHash(data);
    const existingOrder = await this.findIdempotentOrder(
      userId as number,
      idempotencyKey,
      requestHash,
    );
    if (existingOrder) return existingOrder;

    const user = await this.usersService.findOne(userId as number);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    await this.businessesService.findPublicOne(data.businessId);

    let businessOwnerUserId = 0;
    let savedOrder: Order;
    try {
      savedOrder = await this.dataSource.transaction(async (manager) => {
        const business = await manager.findOne(Business, {
          where: { id: data.businessId, status: 'approved' },
          select: { id: true, userId: true },
          lock: { mode: 'pessimistic_read' },
        });

        if (!business) {
          throw new NotFoundException('Negocio no encontrado');
        }

        if (business.userId === userId) {
          throw new ForbiddenException(
            'No puedes realizar pedidos en tu propio negocio',
          );
        }
        businessOwnerUserId = business.userId;

        const catalogItems = await manager.find(CatalogItem, {
          where: {
            id: In(catalogItemIds),
            businessId: data.businessId,
            isActive: true,
            kind: CatalogItemKind.PRODUCT,
            pricingMode: CatalogItemPricingMode.FIXED_PRICE,
          },
          lock: { mode: 'pessimistic_read' },
        });

        if (catalogItems.length !== catalogItemIds.length) {
          throw new ConflictException(
            'El catalogo cambio. Actualiza e intenta nuevamente',
          );
        }

        const catalogById = new Map(
          catalogItems.map((item) => [item.id, item]),
        );
        const lines = data.items.map((requestedItem) => {
          const catalogItem = catalogById.get(requestedItem.catalogItemId);
          if (
            !catalogItem ||
            catalogItem.kind !== CatalogItemKind.PRODUCT ||
            catalogItem.pricingMode !== CatalogItemPricingMode.FIXED_PRICE ||
            !catalogItem.isActive ||
            !Number.isInteger(catalogItem.priceClp)
          ) {
            throw new ConflictException(
              'El catalogo cambio. Actualiza e intenta nuevamente',
            );
          }

          const subtotalClp =
            (catalogItem.priceClp as number) * requestedItem.quantity;
          if (
            !Number.isSafeInteger(subtotalClp) ||
            subtotalClp > MAX_ORDER_LINE_SUBTOTAL_CLP
          ) {
            throw new BadRequestException(
              'El subtotal del articulo es demasiado alto',
            );
          }

          return {
            catalogItemId: catalogItem.id,
            nameSnapshot: catalogItem.name,
            unitPriceClpSnapshot: catalogItem.priceClp as number,
            quantity: requestedItem.quantity,
            subtotalClp,
          };
        });
        const total = lines.reduce((sum, line) => sum + line.subtotalClp, 0);

        if (!Number.isSafeInteger(total) || total > MAX_ORDER_TOTAL_CLP) {
          throw new BadRequestException(
            'El total del pedido es demasiado alto',
          );
        }

        if (!hasValidDeliverySelection(data)) {
          throw new BadRequestException(
            'Selecciona entrega inmediata o una fecha y hora validas',
          );
        }

        const orderRepository = manager.getRepository(Order);
        const orderItemRepository = manager.getRepository(OrderItem);
        const attemptRepository = manager.getRepository(OrderCreationAttempt);
        const order = orderRepository.create({
          businessId: data.businessId,
          userId: userId as number,
          customerName: user.name ?? null,
          customerPhone: user.phone ?? null,
          products: JSON.stringify(
            lines.map((line) => ({
              name: line.nameSnapshot,
              price: line.unitPriceClpSnapshot,
              quantity: line.quantity,
            })),
          ),
          note: data.note ?? null,
          needNow: data.needNow ?? false,
          deliveryDate: data.deliveryDate ?? null,
          deliveryTime: data.deliveryTime ?? null,
          total,
          referencePhoto: data.referencePhoto ?? null,
          status: 'pending',
          cancellationReason: null,
        });
        const savedOrder = await orderRepository.save(order);
        const orderItems = orderItemRepository.create(
          lines.map((line) => ({
            ...line,
            orderId: savedOrder.id,
          })),
        );
        savedOrder.items = await orderItemRepository.save(orderItems);

        await attemptRepository.save(
          attemptRepository.create({
            userId: userId as number,
            idempotencyKey,
            requestHash,
            orderId: savedOrder.id,
          }),
        );

        return savedOrder;
      });
    } catch (error) {
      if (!this.isIdempotencyRace(error)) throw error;
      const concurrentOrder = await this.findIdempotentOrder(
        userId as number,
        idempotencyKey,
        requestHash,
      );
      if (!concurrentOrder) throw error;
      return concurrentOrder;
    }

    await this.pushNotifications?.notifyNewOrder(
      savedOrder,
      businessOwnerUserId,
    );
    return savedOrder;
  }

  async findByUser(userId: number): Promise<Order[]> {
    return this.orderRepository.find({
      where: { userId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findByBusiness(
    businessId: number,
    currentUser?: CurrentUser,
  ): Promise<Order[]> {
    await this.ensureCanAccessBusinessOrders(businessId, currentUser);

    return this.orderRepository.find({
      where: { businessId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    id: number,
    data: UpdateOrderStatusDto,
    currentUser?: CurrentUser,
  ): Promise<Order> {
    const order = await this.findOne(id);
    const cancellationReason = await this.validateStatusTransition(
      order,
      data.status,
      data.cancellationReason,
      currentUser,
    );
    const updateData: Partial<Order> = { status: data.status };

    if (data.status === 'cancelled') {
      updateData.cancellationReason = cancellationReason ?? null;
    }

    const result = await this.orderRepository.update(
      { id, status: order.status },
      updateData,
    );

    if (result.affected !== 1) {
      throw new ConflictException(
        'El pedido cambió mientras realizabas esta acción. Actualiza e intenta nuevamente.',
      );
    }

    return this.findOne(id);
  }
}
