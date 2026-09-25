import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  CatalogItem,
  CatalogItemKind,
  CatalogItemPricingMode,
} from '../catalog/catalog-item.entity';
import { Business } from '../businesses/business.entity';
import { BusinessesService } from '../businesses/businesses.service';
import { UsersService } from '../users/users.service';
import { OrderItem } from './order-item.entity';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';
import { PushNotificationsService } from '../notifications/push-notifications.service';
import { OrderCreationAttempt } from './order-creation-attempt.entity';

describe('OrdersService secure creation', () => {
  const user = { id: 10, name: 'Cliente', phone: '+56911111111' };
  const business = { id: 20, userId: 30, status: 'approved' } as Business;
  const chocolateCake = {
    id: 5,
    businessId: 20,
    name: 'Torta de chocolate',
    kind: CatalogItemKind.PRODUCT,
    pricingMode: CatalogItemPricingMode.FIXED_PRICE,
    priceClp: 12000,
    isActive: true,
  } as CatalogItem;
  const vanillaCake = {
    ...chocolateCake,
    id: 8,
    name: 'Torta de vainilla',
    priceClp: 8000,
  } as CatalogItem;

  let service: OrdersService;
  let usersService: { findOne: jest.Mock };
  let manager: {
    findOne: jest.Mock;
    find: jest.Mock;
    getRepository: jest.Mock;
  };
  let orderRepository: { create: jest.Mock; save: jest.Mock };
  let orderItemRepository: { create: jest.Mock; save: jest.Mock };
  let attemptRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let pushNotifications: { notifyNewOrder: jest.Mock };
  let businessesService: { findOne: jest.Mock; findPublicOne: jest.Mock };

  beforeEach(async () => {
    orderRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ id: 50, ...data })),
    };
    orderItemRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
    };
    attemptRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
      findOne: jest.fn().mockResolvedValue(null),
    };
    manager = {
      findOne: jest.fn().mockResolvedValue(business),
      find: jest.fn().mockResolvedValue([chocolateCake, vanillaCake]),
      getRepository: jest.fn((entity) => {
        if (entity === Order) return orderRepository;
        if (entity === OrderItem) return orderItemRepository;
        if (entity === OrderCreationAttempt) return attemptRepository;
        throw new Error('Unexpected repository');
      }),
    };
    dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
      getRepository: jest.fn(() => attemptRepository),
    };
    usersService = { findOne: jest.fn().mockResolvedValue(user) };
    pushNotifications = { notifyNewOrder: jest.fn() };
    businessesService = {
      findOne: jest.fn(),
      findPublicOne: jest.fn().mockResolvedValue(business),
    };

    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: { findOne: jest.fn(), update: jest.fn(), find: jest.fn() },
        },
        { provide: BusinessesService, useValue: businessesService },
        { provide: UsersService, useValue: usersService },
        { provide: DataSource, useValue: dataSource },
        { provide: PushNotificationsService, useValue: pushNotifications },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('rejects orders for a business that is not publicly complete', async () => {
    businessesService.findPublicOne.mockRejectedValue(
      new NotFoundException('Negocio no encontrado'),
    );

    await expect(
      service.create(
        {
          businessId: 20,
          items: [{ catalogItemId: 5, quantity: 1 }],
          note: 'Pedido de prueba',
          needNow: true,
          deliveryDate: null,
          deliveryTime: null,
        },
        10,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('uses official catalog prices and stores immutable snapshots', async () => {
    const result = await service.create(
      {
        businessId: 20,
        items: [
          { catalogItemId: 5, quantity: 2 },
          { catalogItemId: 8, quantity: 1 },
        ],
        note: 'Para manana',
        needNow: true,
        deliveryDate: null,
        deliveryTime: null,
      },
      10,
    );

    expect(orderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 20,
        userId: 10,
        customerName: 'Cliente',
        customerPhone: '+56911111111',
        products: JSON.stringify([
          { name: 'Torta de chocolate', price: 12000, quantity: 2 },
          { name: 'Torta de vainilla', price: 8000, quantity: 1 },
        ]),
        total: 32000,
        status: 'pending',
      }),
    );
    expect(orderItemRepository.create).toHaveBeenCalledWith([
      {
        catalogItemId: 5,
        nameSnapshot: 'Torta de chocolate',
        unitPriceClpSnapshot: 12000,
        quantity: 2,
        subtotalClp: 24000,
        orderId: 50,
      },
      {
        catalogItemId: 8,
        nameSnapshot: 'Torta de vainilla',
        unitPriceClpSnapshot: 8000,
        quantity: 1,
        subtotalClp: 8000,
        orderId: 50,
      },
    ]);
    expect(pushNotifications.notifyNewOrder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 50, total: 32000 }),
      30,
    );
    expect(result.items).toHaveLength(2);
  });

  it('returns the original order for the same key and payload without notifying twice', async () => {
    manager.find.mockResolvedValue([chocolateCake]);
    const idempotencyKey = '123e4567-e89b-42d3-a456-426614174000';
    const payload = {
      businessId: 20,
      items: [{ catalogItemId: 5, quantity: 1 }],
      needNow: true,
      deliveryDate: null,
      deliveryTime: null,
    };

    const firstOrder = await service.create(payload, 10, idempotencyKey);
    const savedAttempt = attemptRepository.save.mock.calls[0][0];
    attemptRepository.findOne.mockResolvedValue({
      ...savedAttempt,
      order: firstOrder,
    });

    const repeatedOrder = await service.create(payload, 10, idempotencyKey);

    expect(repeatedOrder).toBe(firstOrder);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(orderRepository.save).toHaveBeenCalledTimes(1);
    expect(pushNotifications.notifyNewOrder).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of the same key for a different order', async () => {
    const idempotencyKey = '123e4567-e89b-42d3-a456-426614174000';
    attemptRepository.findOne.mockResolvedValue({
      requestHash: 'different-request-hash',
      order: { id: 50 },
    });

    await expect(
      service.create(
        {
          businessId: 20,
          items: [{ catalogItemId: 5, quantity: 1 }],
          needNow: true,
          deliveryDate: null,
          deliveryTime: null,
        },
        10,
        idempotencyKey,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(pushNotifications.notifyNewOrder).not.toHaveBeenCalled();
  });

  it('recovers the winning order when two equal requests arrive together', async () => {
    const idempotencyKey = '123e4567-e89b-42d3-a456-426614174000';
    const payload = {
      businessId: 20,
      items: [{ catalogItemId: 5, quantity: 1 }],
      needNow: true,
      deliveryDate: null,
      deliveryTime: null,
    };
    const winningOrder = { id: 51, items: [{ id: 60 }] } as Order;
    const requestHash = (
      service as unknown as {
        requestHash: (value: typeof payload) => string;
      }
    ).requestHash(payload);
    attemptRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ requestHash, order: winningOrder });
    dataSource.transaction.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], {
        code: '23505',
        constraint: 'UQ_order_creation_attempt_user_key',
      }),
    );

    await expect(service.create(payload, 10, idempotencyKey)).resolves.toBe(
      winningOrder,
    );

    expect(attemptRepository.findOne).toHaveBeenCalledTimes(2);
    expect(pushNotifications.notifyNewOrder).not.toHaveBeenCalled();
  });

  it('sets pending and ignores forged legacy price fields at service runtime', async () => {
    manager.find.mockResolvedValue([chocolateCake]);
    await service.create(
      {
        businessId: 20,
        items: [{ catalogItemId: 5, quantity: 1 }],
        total: 1,
        products: 'forged',
        status: 'completed',
        needNow: true,
        deliveryDate: null,
        deliveryTime: null,
      } as never,
      10,
    );

    expect(orderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ total: 12000, status: 'pending' }),
    );
  });

  it('rejects missing or stale authenticated users', async () => {
    await expect(
      service.create({
        businessId: 20,
        items: [{ catalogItemId: 5, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    usersService.findOne.mockResolvedValue(null);
    await expect(
      service.create(
        { businessId: 20, items: [{ catalogItemId: 5, quantity: 1 }] },
        404,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects an unapproved or missing business', async () => {
    manager.findOne.mockResolvedValue(null);

    await expect(
      service.create(
        { businessId: 20, items: [{ catalogItemId: 5, quantity: 1 }] },
        10,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks the owner from ordering from their own business', async () => {
    usersService.findOne.mockResolvedValue({ ...user, id: 30 });

    await expect(
      service.create(
        { businessId: 20, items: [{ catalogItemId: 5, quantity: 1 }] },
        30,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.find).not.toHaveBeenCalled();
  });

  it.each(['missing', 'inactive', 'quote', 'view', 'another business'])(
    'rejects a %s catalog item through the same safe conflict',
    async () => {
      manager.find.mockResolvedValue([]);

      await expect(
        service.create(
          { businessId: 20, items: [{ catalogItemId: 5, quantity: 1 }] },
          10,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(orderRepository.save).not.toHaveBeenCalled();
    },
  );

  it('rejects a fixed-price service while its request flow is unavailable', async () => {
    manager.find.mockResolvedValue([
      {
        ...chocolateCake,
        kind: CatalogItemKind.SERVICE,
      },
    ]);

    await expect(
      service.create(
        { businessId: 20, items: [{ catalogItemId: 5, quantity: 1 }] },
        10,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(orderRepository.save).not.toHaveBeenCalled();
  });

  it('rejects duplicate IDs before opening a transaction', async () => {
    await expect(
      service.create(
        {
          businessId: 20,
          items: [
            { catalogItemId: 5, quantity: 1 },
            { catalogItemId: 5, quantity: 2 },
          ],
        },
        10,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it.each([
    { businessId: 0, items: [{ catalogItemId: 5, quantity: 1 }] },
    { businessId: 20, items: [] },
    { businessId: 20, items: [{ catalogItemId: 0, quantity: 1 }] },
    { businessId: 20, items: [{ catalogItemId: 5, quantity: 0 }] },
    { businessId: 20, items: [{ catalogItemId: 5, quantity: 100 }] },
  ])('rejects malformed items even when called outside HTTP', async (data) => {
    await expect(service.create(data, 10)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a line subtotal that does not fit the database integer', async () => {
    manager.find.mockResolvedValue([
      { ...chocolateCake, priceClp: 30_000_000 },
    ]);

    await expect(
      service.create(
        { businessId: 20, items: [{ catalogItemId: 5, quantity: 99 }] },
        10,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reads catalog rows under a transaction lock', async () => {
    manager.find.mockResolvedValue([chocolateCake]);
    await service.create(
      {
        businessId: 20,
        items: [{ catalogItemId: 5, quantity: 1 }],
        needNow: true,
        deliveryDate: null,
        deliveryTime: null,
      },
      10,
    );

    expect(manager.find).toHaveBeenCalledWith(
      CatalogItem,
      expect.objectContaining({
        where: expect.objectContaining({
          kind: CatalogItemKind.PRODUCT,
          pricingMode: CatalogItemPricingMode.FIXED_PRICE,
        }),
        lock: { mode: 'pessimistic_read' },
      }),
    );
  });

  it.each([
    { needNow: false, deliveryDate: null, deliveryTime: null },
    { needNow: false, deliveryDate: '2026-09-20', deliveryTime: null },
    { needNow: true, deliveryDate: '2026-09-20', deliveryTime: '13:30' },
  ])(
    'rejects an incomplete or contradictory delivery selection',
    async (delivery) => {
      manager.find.mockResolvedValue([chocolateCake]);
      await expect(
        service.create(
          {
            businessId: 20,
            items: [{ catalogItemId: 5, quantity: 1 }],
            ...delivery,
          },
          10,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(orderRepository.save).not.toHaveBeenCalled();
    },
  );
});
