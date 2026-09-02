import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BusinessesService } from '../businesses/businesses.service';
import { UsersService } from '../users/users.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order } from './order.entity';
import type { CancellationReason, OrderStatus } from './order-status';
import { OrdersService } from './orders.service';

describe('OrdersService status transitions', () => {
  let service: OrdersService;
  let orderRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let businessesService: { findOne: jest.Mock };

  const baseOrder = {
    id: 1,
    businessId: 20,
    userId: 10,
    products: '[]',
    status: 'pending',
    cancellationReason: null,
  } as Order;
  const business = { id: 20, userId: 30 };
  const customer = { id: 10, role: 'user' };
  const businessOwner = { id: 30, role: 'user' };
  const admin = { id: 99, role: 'admin' };

  beforeEach(async () => {
    orderRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    businessesService = { findOne: jest.fn().mockResolvedValue(business) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: BusinessesService, useValue: businessesService },
        { provide: UsersService, useValue: { findOne: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  async function expectAllowedTransition(options: {
    from: OrderStatus;
    to: OrderStatus;
    user: { id: number; role: string };
    cancellationReason?: CancellationReason;
  }) {
    const currentOrder = { ...baseOrder, status: options.from } as Order;
    const updatedOrder = {
      ...currentOrder,
      status: options.to,
      cancellationReason: options.cancellationReason ?? null,
    } as Order;
    const dto = {
      status: options.to,
      cancellationReason: options.cancellationReason,
    } as UpdateOrderStatusDto;
    const updateData: Partial<Order> = { status: options.to };

    if (options.to === 'cancelled') {
      updateData.cancellationReason = options.cancellationReason ?? null;
    }

    orderRepository.findOne
      .mockResolvedValueOnce(currentOrder)
      .mockResolvedValueOnce(updatedOrder);
    orderRepository.update.mockResolvedValue({ affected: 1 });

    await expect(service.updateStatus(1, dto, options.user)).resolves.toEqual(
      updatedOrder,
    );
    expect(orderRepository.update).toHaveBeenCalledWith(
      { id: 1, status: options.from },
      updateData,
    );
  }

  it.each([
    ['pending', 'accepted', businessOwner],
    ['pending', 'accepted', admin],
    ['pending', 'rejected', businessOwner],
    ['pending', 'rejected', admin],
    ['accepted', 'ready', businessOwner],
    ['ready', 'completed', customer],
    ['ready', 'completed', businessOwner],
  ] as const)(
    'allows %s → %s for the correct actor',
    async (from, to, user) => {
      await expectAllowedTransition({ from, to, user });
    },
  );

  it('allows the customer to cancel a pending order with a valid reason', async () => {
    await expectAllowedTransition({
      from: 'pending',
      to: 'cancelled',
      user: customer,
      cancellationReason: 'selected_by_mistake',
    });
  });

  it.each([
    ['pending', 'accepted', customer],
    ['pending', 'rejected', customer],
    ['pending', 'cancelled', businessOwner],
    ['accepted', 'ready', customer],
    ['accepted', 'ready', admin],
    ['ready', 'completed', admin],
  ] as const)(
    'rejects %s → %s when the actor lacks permission',
    async (from, to, user) => {
      orderRepository.findOne.mockResolvedValue({ ...baseOrder, status: from });

      await expect(
        service.updateStatus(1, { status: to }, user),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(orderRepository.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['accepted', 'rejected'],
    ['accepted', 'cancelled'],
    ['pending', 'ready'],
    ['pending', 'completed'],
    ['ready', 'cancelled'],
    ['pending', 'pending'],
  ] as const)('rejects the invalid transition %s → %s', async (from, to) => {
    orderRepository.findOne.mockResolvedValue({ ...baseOrder, status: from });

    await expect(
      service.updateStatus(1, { status: to }, businessOwner),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orderRepository.update).not.toHaveBeenCalled();
  });

  it.each(['rejected', 'cancelled', 'completed'] as const)(
    'rejects every transition from final state %s for customer, business and admin',
    async (from) => {
      for (const user of [customer, businessOwner, admin]) {
        orderRepository.findOne.mockResolvedValueOnce({
          ...baseOrder,
          status: from,
        });

        await expect(
          service.updateStatus(1, { status: 'pending' }, user),
        ).rejects.toBeInstanceOf(BadRequestException);
      }

      expect(orderRepository.update).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, 'other'])(
    'rejects pending → cancelled with invalid reason %s',
    async (cancellationReason) => {
      orderRepository.findOne.mockResolvedValue(baseOrder);

      await expect(
        service.updateStatus(
          1,
          { status: 'cancelled', cancellationReason } as UpdateOrderStatusDto,
          customer,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(orderRepository.update).not.toHaveBeenCalled();
    },
  );

  it('ignores a cancellation reason for a non-cancellation transition', async () => {
    orderRepository.findOne
      .mockResolvedValueOnce(baseOrder)
      .mockResolvedValueOnce({ ...baseOrder, status: 'accepted' });
    orderRepository.update.mockResolvedValue({ affected: 1 });

    await service.updateStatus(
      1,
      {
        status: 'accepted',
        cancellationReason: 'selected_by_mistake',
      },
      businessOwner,
    );

    expect(orderRepository.update).toHaveBeenCalledWith(
      { id: 1, status: 'pending' },
      { status: 'accepted' },
    );
  });

  it('blocks an unrelated user before revealing whether a transition is valid', async () => {
    orderRepository.findOne.mockResolvedValue({
      ...baseOrder,
      status: 'accepted',
    });

    await expect(
      service.updateStatus(
        1,
        { status: 'rejected' },
        { id: 777, role: 'user' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an unknown requested status at runtime', async () => {
    orderRepository.findOne.mockResolvedValue(baseOrder);

    await expect(
      service.updateStatus(
        1,
        { status: 'unknown' } as unknown as UpdateOrderStatusDto,
        customer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns conflict when another request changes the order first', async () => {
    orderRepository.findOne.mockResolvedValue(baseOrder);
    orderRepository.update.mockResolvedValue({ affected: 0 });

    await expect(
      service.updateStatus(1, { status: 'accepted' }, businessOwner),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found when the order does not exist', async () => {
    orderRepository.findOne.mockResolvedValue(null);

    await expect(
      service.updateStatus(999, { status: 'accepted' }, businessOwner),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(businessesService.findOne).not.toHaveBeenCalled();
  });
});
