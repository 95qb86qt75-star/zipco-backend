import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  CatalogItem,
  CatalogItemPricingMode,
} from '../catalog/catalog-item.entity';
import { Business } from '../businesses/business.entity';
import { BusinessesService } from '../businesses/businesses.service';
import { UsersService } from '../users/users.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
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

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private businessesService: BusinessesService,
    private usersService: UsersService,
    private dataSource: DataSource,
  ) {}

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

  async create(data: CreateOrderDto, userId?: number): Promise<Order> {
    if (!Number.isInteger(userId) || (userId ?? 0) <= 0) {
      throw new UnauthorizedException('Sesion no valida');
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

    const user = await this.usersService.findOne(userId as number);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return this.dataSource.transaction(async (manager) => {
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

      const catalogItems = await manager.find(CatalogItem, {
        where: {
          id: In(catalogItemIds),
          businessId: data.businessId,
          isActive: true,
          pricingMode: CatalogItemPricingMode.FIXED_PRICE,
        },
        lock: { mode: 'pessimistic_read' },
      });

      if (catalogItems.length !== catalogItemIds.length) {
        throw new ConflictException(
          'El catalogo cambio. Actualiza e intenta nuevamente',
        );
      }

      const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
      const lines = data.items.map((requestedItem) => {
        const catalogItem = catalogById.get(requestedItem.catalogItemId);
        if (!catalogItem || !Number.isInteger(catalogItem.priceClp)) {
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
        throw new BadRequestException('El total del pedido es demasiado alto');
      }

      const orderRepository = manager.getRepository(Order);
      const orderItemRepository = manager.getRepository(OrderItem);
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

      return savedOrder;
    });
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
