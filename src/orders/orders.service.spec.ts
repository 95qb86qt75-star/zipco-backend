import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BusinessesService } from '../businesses/businesses.service';
import { UsersService } from '../users/users.service';
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
  let usersService: {
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

    usersService = {
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
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create() stores customerName and customerPhone from the real user', async () => {
    const orderData = {
      businessId: 20,
      userId: 10,
      products: '[]',
      total: 8000,
    };
    const createdOrder = {
      ...orderData,
      customerName: 'Bastian',
      customerPhone: '+56965169255',
    } as Order;

    usersService.findOne.mockResolvedValue({
      id: 10,
      name: 'Bastian',
      phone: '+56965169255',
      password: 'hashed-password',
    });
    orderRepository.create.mockReturnValue(createdOrder);
    orderRepository.save.mockResolvedValue(createdOrder);

    await expect(service.create(orderData)).resolves.toEqual(createdOrder);

    expect(usersService.findOne).toHaveBeenCalledWith(10);
    expect(orderRepository.create).toHaveBeenCalledWith({
      ...orderData,
      customerName: 'Bastian',
      customerPhone: '+56965169255',
    });
    expect(orderRepository.save).toHaveBeenCalledWith(createdOrder);
  });

  it('create() stores null customerName and customerPhone when the user does not exist', async () => {
    const orderData = {
      businessId: 20,
      userId: 999,
      products: '[]',
      total: 8000,
    };
    const createdOrder = {
      ...orderData,
      customerName: null,
      customerPhone: null,
    } as Order;

    usersService.findOne.mockResolvedValue(null);
    orderRepository.create.mockReturnValue(createdOrder);
    orderRepository.save.mockResolvedValue(createdOrder);

    await expect(service.create(orderData)).resolves.toEqual(createdOrder);

    expect(usersService.findOne).toHaveBeenCalledWith(999);
    expect(orderRepository.create).toHaveBeenCalledWith({
      ...orderData,
      customerName: null,
      customerPhone: null,
    });
    expect(orderRepository.save).toHaveBeenCalledWith(createdOrder);
  });

  it("updateStatus() allows the business owner to change the order to 'accepted'", async () => {
    const acceptedOrder = { ...baseOrder, status: 'accepted' } as Order;

    orderRepository.findOne
      .mockResolvedValueOnce(baseOrder)
      .mockResolvedValueOnce(acceptedOrder);
    orderRepository.update.mockResolvedValue({ affected: 1 });
    businessesService.findOne.mockResolvedValue(business);

    await expect(
      service.updateStatus(1, { status: 'accepted' }, { id: 30, role: 'user' }),
    ).resolves.toEqual(acceptedOrder);

    expect(businessesService.findOne).toHaveBeenCalledWith(20);
    expect(orderRepository.update).toHaveBeenCalledWith(
      { id: 1, status: 'pending' },
      { status: 'accepted' },
    );
  });

  it("updateStatus() allows the business owner to change the order to 'rejected'", async () => {
    const rejectedOrder = { ...baseOrder, status: 'rejected' } as Order;

    orderRepository.findOne
      .mockResolvedValueOnce(baseOrder)
      .mockResolvedValueOnce(rejectedOrder);
    orderRepository.update.mockResolvedValue({ affected: 1 });
    businessesService.findOne.mockResolvedValue(business);

    await expect(
      service.updateStatus(1, { status: 'rejected' }, { id: 30, role: 'user' }),
    ).resolves.toEqual(rejectedOrder);

    expect(businessesService.findOne).toHaveBeenCalledWith(20);
    expect(orderRepository.update).toHaveBeenCalledWith(
      { id: 1, status: 'pending' },
      { status: 'rejected' },
    );
  });

  it.each(['accepted', 'rejected'] as const)(
    "updateStatus() allows an admin to change the order to '%s'",
    async (status) => {
      const updatedOrder = { ...baseOrder, status } as Order;

      orderRepository.findOne
        .mockResolvedValueOnce(baseOrder)
        .mockResolvedValueOnce(updatedOrder);
      orderRepository.update.mockResolvedValue({ affected: 1 });
      businessesService.findOne.mockResolvedValue(business);

      await expect(
        service.updateStatus(1, { status }, { id: 99, role: 'admin' }),
      ).resolves.toEqual(updatedOrder);

      expect(businessesService.findOne).toHaveBeenCalledWith(20);
      expect(orderRepository.update).toHaveBeenCalledWith(
        { id: 1, status: 'pending' },
        { status },
      );
    },
  );

  it('updateStatus() blocks a user who is not customer, business owner, or admin', async () => {
    orderRepository.findOne.mockResolvedValue(baseOrder);
    businessesService.findOne.mockResolvedValue(business);

    await expect(
      service.updateStatus(1, { status: 'accepted' }, { id: 99, role: 'user' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(businessesService.findOne).toHaveBeenCalledWith(20);
    expect(orderRepository.update).not.toHaveBeenCalled();
  });

  it('updateStatus() throws NotFoundException when the order does not exist', async () => {
    orderRepository.findOne.mockResolvedValue(null);

    await expect(
      service.updateStatus(
        999,
        { status: 'accepted' },
        { id: 30, role: 'user' },
      ),
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
