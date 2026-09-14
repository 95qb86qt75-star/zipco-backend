import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: { create: jest.Mock; updateStatus: jest.Mock };

  beforeEach(async () => {
    ordersService = { create: jest.fn(), updateStatus: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() always uses the authenticated user id', async () => {
    const body = {
      businessId: 20,
      items: [{ catalogItemId: 5, quantity: 2 }],
    };
    const createdOrder = { id: 1, businessId: 20, userId: 10 };

    ordersService.create.mockResolvedValue(createdOrder);

    await expect(
      controller.create(body as never, { user: { id: 10, role: 'user' } }),
    ).resolves.toEqual(createdOrder);

    expect(ordersService.create).toHaveBeenCalledWith(body, 10);
  });

  it('passes only status and cancellationReason to the service', async () => {
    const user = { id: 10, role: 'user' };
    const unsafeBody = {
      status: 'cancelled',
      cancellationReason: 'selected_by_mistake',
      userId: 999,
      businessId: 999,
      total: 1,
      customerName: 'Otro nombre',
    };
    ordersService.updateStatus.mockResolvedValue({
      id: 1,
      status: 'cancelled',
    });

    await controller.updateStatus(1, unsafeBody as never, { user });

    expect(ordersService.updateStatus).toHaveBeenCalledWith(
      1,
      {
        status: 'cancelled',
        cancellationReason: 'selected_by_mistake',
      },
      user,
    );
  });
});
