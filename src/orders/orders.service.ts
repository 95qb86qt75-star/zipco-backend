import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessesService } from '../businesses/businesses.service';
import { UsersService } from '../users/users.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order } from './order.entity';
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

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private businessesService: BusinessesService,
    private usersService: UsersService,
  ) {}

  private async findOne(id: number): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id } });

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

  async create(data: Partial<Order>): Promise<Order> {
    let customerName: string | null = null;
    let customerPhone: string | null = null;

    if (data.userId) {
      const user = await this.usersService.findOne(data.userId);

      customerName = user?.name ?? null;
      customerPhone = user?.phone ?? null;
    }

    const order = this.orderRepository.create({
      ...data,
      customerName,
      customerPhone,
    });

    return this.orderRepository.save(order);
  }

  async findByUser(userId: number): Promise<Order[]> {
    return this.orderRepository.find({
      where: { userId },
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
