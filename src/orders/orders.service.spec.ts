import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BusinessesService } from '../businesses/businesses.service';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let businessesService: {
    findOne: jest.Mock;
  };

  const baseOrder = {
    id: 1,
    businessId: 20,
    userId: 10,
    products: '[]',
    status: 'pending',
  } as Order;

  const business = {
    id: 20,
    userId: 30,
  };

  beforeEach(async () => {
    orderRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    businessesService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: orderRepository,
        },
        {
          provide: BusinessesService,
          useValue: businessesService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it("updateStatus() allows the customer to change a pending order to 'cancelled'", async () => {
    const cancelledOrder = { ...baseOrder, status: 'cancelled' } as Order;

    orderRepository.findOne
      .mockResolvedValueOnce(baseOrder)
      .mockResolvedValueOnce(cancelledOrder);
    orderRepository.update.mockResolvedValue({ affected: 1 });

    await expect(
      service.updateStatus(1, 'cancelled', { id: 10, role: 'user' }),
    ).resolves.toEqual(cancelledOrder);

    expect(orderRepository.update).toHaveBeenCalledWith(1, { status: 'cancelled' });
    expect(businessesService.findOne).not.toHaveBeenCalled();
  });

  it("updateStatus() blocks the customer from changing their own order to 'accepted'", async () => {
    orderRepository.findOne.mockResolvedValue(baseOrder);

    await expect(
      service.updateStatus(1, 'accepted', { id: 10, role: 'user' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(orderRepository.update).not.toHaveBeenCalled();
    expect(businessesService.findOne).not.toHaveBeenCalled();
  });

  it.each(['accepted', 'rejected'])(
    "updateStatus() blocks the customer from cancelling when the order is already '%s'",
    async (currentStatus) => {
      orderRepository.findOne.mockResolvedValue({
        ...baseOrder,
        status: currentStatus,
      });

      await expect(
        service.updateStatus(1, 'cancelled', { id: 10, role: 'user' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(orderRepository.update).not.toHaveBeenCalled();
      expect(businessesService.findOne).not.toHaveBeenCalled();
    },
  );

  it("updateStatus() allows the business owner to change the order to 'accepted'", async () => {
    const acceptedOrder = { ...baseOrder, status: 'accepted' } as Order;

    orderRepository.findOne
      .mockResolvedValueOnce(baseOrder)
      .mockResolvedValueOnce(acceptedOrder);
    orderRepository.update.mockResolvedValue({ affected: 1 });
    businessesService.findOne.mockResolvedValue(business);

    await expect(
      service.updateStatus(1, 'accepted', { id: 30, role: 'user' }),
    ).resolves.toEqual(acceptedOrder);

    expect(businessesService.findOne).toHaveBeenCalledWith(20);
    expect(orderRepository.update).toHaveBeenCalledWith(1, { status: 'accepted' });
  });

  it("updateStatus() allows the business owner to change the order to 'rejected'", async () => {
    const rejectedOrder = { ...baseOrder, status: 'rejected' } as Order;

    orderRepository.findOne
      .mockResolvedValueOnce(baseOrder)
      .mockResolvedValueOnce(rejectedOrder);
    orderRepository.update.mockResolvedValue({ affected: 1 });
    businessesService.findOne.mockResolvedValue(business);

    await expect(
      service.updateStatus(1, 'rejected', { id: 30, role: 'user' }),
    ).resolves.toEqual(rejectedOrder);

    expect(businessesService.findOne).toHaveBeenCalledWith(20);
    expect(orderRepository.update).toHaveBeenCalledWith(1, { status: 'rejected' });
  });

  it.each(['accepted', 'rejected'])(
    "updateStatus() allows an admin to change the order to '%s'",
    async (status) => {
      const updatedOrder = { ...baseOrder, status } as Order;

      orderRepository.findOne
        .mockResolvedValueOnce(baseOrder)
        .mockResolvedValueOnce(updatedOrder);
      orderRepository.update.mockResolvedValue({ affected: 1 });
      businessesService.findOne.mockResolvedValue(business);

      await expect(
        service.updateStatus(1, status, { id: 99, role: 'admin' }),
      ).resolves.toEqual(updatedOrder);

      expect(businessesService.findOne).toHaveBeenCalledWith(20);
      expect(orderRepository.update).toHaveBeenCalledWith(1, { status });
    },
  );

  it('updateStatus() blocks a user who is not customer, business owner, or admin', async () => {
    orderRepository.findOne.mockResolvedValue(baseOrder);
    businessesService.findOne.mockResolvedValue(business);

    await expect(
      service.updateStatus(1, 'accepted', { id: 99, role: 'user' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(businessesService.findOne).toHaveBeenCalledWith(20);
    expect(orderRepository.update).not.toHaveBeenCalled();
  });

  it('updateStatus() throws NotFoundException when the order does not exist', async () => {
    orderRepository.findOne.mockResolvedValue(null);

    await expect(
      service.updateStatus(999, 'accepted', { id: 30, role: 'user' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(orderRepository.update).not.toHaveBeenCalled();
    expect(businessesService.findOne).not.toHaveBeenCalled();
  });

  it('findByBusiness() allows the business owner to see orders for their own business', async () => {
    const orders = [baseOrder];

    businessesService.findOne.mockResolvedValue(business);
    orderRepository.find.mockResolvedValue(orders);

    await expect(
      service.findByBusiness(20, { id: 30, role: 'user' }),
    ).resolves.toEqual(orders);

    expect(businessesService.findOne).toHaveBeenCalledWith(20);
    expect(orderRepository.find).toHaveBeenCalledWith({
      where: { businessId: 20 },
      order: { createdAt: 'DESC' },
    });
  });

  it('findByBusiness() allows an admin to see orders for any business', async () => {
    const orders = [baseOrder];

    businessesService.findOne.mockResolvedValue(business);
    orderRepository.find.mockResolvedValue(orders);

    await expect(
      service.findByBusiness(20, { id: 99, role: 'admin' }),
    ).resolves.toEqual(orders);

    expect(businessesService.findOne).toHaveBeenCalledWith(20);
    expect(orderRepository.find).toHaveBeenCalledWith({
      where: { businessId: 20 },
      order: { createdAt: 'DESC' },
    });
  });

  it('findByBusiness() blocks a user who is not business owner or admin', async () => {
    businessesService.findOne.mockResolvedValue(business);

    await expect(
      service.findByBusiness(20, { id: 99, role: 'user' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(businessesService.findOne).toHaveBeenCalledWith(20);
    expect(orderRepository.find).not.toHaveBeenCalled();
  });
});
