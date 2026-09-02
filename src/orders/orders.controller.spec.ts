import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: { updateStatus: jest.Mock };

  beforeEach(async () => {
    ordersService = { updateStatus: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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
