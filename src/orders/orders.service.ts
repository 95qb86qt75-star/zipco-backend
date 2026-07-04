import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessesService } from '../businesses/businesses.service';
import { Order } from './order.entity';

type CurrentUser = {
  id?: number;
  role?: string;
};

const CUSTOMER_ALLOWED_STATUS = 'cancelled';
const BUSINESS_ALLOWED_STATUSES = ['accepted', 'rejected'];

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private businessesService: BusinessesService,
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

    throw new ForbiddenException('No tienes permiso para ver los pedidos de este negocio');
  }

  private async ensureCanUpdateStatus(
    order: Order,
    status: string,
    currentUser?: CurrentUser,
  ) {
    const isCustomer = order.userId === currentUser?.id;

    if (isCustomer) {
      if (status === CUSTOMER_ALLOWED_STATUS && order.status === 'pending') {
        return;
      }

      throw new ForbiddenException('No tienes permiso para cambiar este pedido a ese estado');
    }

    const business = await this.businessesService.findOne(order.businessId);
    const isBusinessOwner = business.userId === currentUser?.id;
    const isAdmin = currentUser?.role === 'admin';

    if (isBusinessOwner || isAdmin) {
      if (BUSINESS_ALLOWED_STATUSES.includes(status)) {
        return;
      }

      throw new ForbiddenException('No tienes permiso para cambiar este pedido a ese estado');
    }

    throw new ForbiddenException('No tienes permiso para modificar este pedido');
  }

  async create(data: Partial<Order>): Promise<Order> {
    const order = this.orderRepository.create(data);
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
    status: string,
    currentUser?: CurrentUser,
  ): Promise<Order> {
    const order = await this.findOne(id);

    await this.ensureCanUpdateStatus(order, status, currentUser);

    await this.orderRepository.update(id, { status });

    return this.findOne(id);
  }
}
