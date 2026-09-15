import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    orderRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ id: 50, ...data })),
    };
    orderItemRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
    };
    manager = {
      findOne: jest.fn().mockResolvedValue(business),
      find: jest.fn().mockResolvedValue([chocolateCake, vanillaCake]),
      getRepository: jest.fn((entity) =>
        entity === Order ? orderRepository : orderItemRepository,
      ),
    };
    dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    usersService = { findOne: jest.fn().mockResolvedValue(user) };

    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: { findOne: jest.fn(), update: jest.fn(), find: jest.fn() },
        },
        { provide: BusinessesService, useValue: { findOne: jest.fn() } },
        { provide: UsersService, useValue: usersService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(OrdersService);
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
    expect(result.items).toHaveLength(2);
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
      { businessId: 20, items: [{ catalogItemId: 5, quantity: 1 }] },
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
});
