import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Business } from '../businesses/business.entity';
import {
  CatalogItem,
  CatalogItemPricingMode,
} from '../catalog/catalog-item.entity';
import { UsersService } from '../users/users.service';
import { PushNotificationsService } from '../notifications/push-notifications.service';
import { QuoteRequest } from './quote-request.entity';
import { QuotesService } from './quotes.service';

describe('QuotesService security and consistency', () => {
  const user = { id: 10, name: 'Cliente', phone: '+56911111111' };
  const business = { id: 20, userId: 30, status: 'approved' } as Business;
  const item = {
    id: 5,
    businessId: 20,
    name: 'Cambio de caneria',
    description: 'Reemplazo de canerias',
    pricingMode: CatalogItemPricingMode.QUOTE,
    startingPriceClp: 10000,
    isActive: true,
  } as CatalogItem;
  const dto = {
    businessId: 20,
    catalogItemId: 5,
    message: 'Necesito reparar una filtracion',
    needNow: true,
    idempotencyKey: '3c2233e0-cda1-4b70-8db4-66fc1d08bf72',
  };

  let service: QuotesService;
  let quoteRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
  };
  let manager: { findOne: jest.Mock; getRepository: jest.Mock };
  let savedRepository: { create: jest.Mock; save: jest.Mock };
  let businessRepository: { findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let pushNotifications: {
    notifyNewQuote: jest.Mock;
    notifyQuoteResponded: jest.Mock;
    notifyQuoteStatusChanged: jest.Mock;
  };

  beforeEach(async () => {
    quoteRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };
    savedRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 40, ...value })),
    };
    manager = {
      findOne: jest
        .fn()
        .mockImplementation((entity) =>
          Promise.resolve(entity === Business ? business : item),
        ),
      getRepository: jest.fn().mockReturnValue(savedRepository),
    };
    businessRepository = { findOne: jest.fn().mockResolvedValue(business) };
    dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
      getRepository: jest.fn().mockReturnValue(businessRepository),
    };
    pushNotifications = {
      notifyNewQuote: jest.fn(),
      notifyQuoteResponded: jest.fn(),
      notifyQuoteStatusChanged: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        QuotesService,
        {
          provide: getRepositoryToken(QuoteRequest),
          useValue: quoteRepository,
        },
        { provide: UsersService, useValue: { findOne: jest.fn(() => user) } },
        { provide: DataSource, useValue: dataSource },
        { provide: PushNotificationsService, useValue: pushNotifications },
      ],
    }).compile();
    service = module.get(QuotesService);
  });

  it('returns an existing idempotent request without creating another one', async () => {
    const existing = { id: 99, userId: 10, ...dto };
    quoteRepository.findOne.mockResolvedValue(existing);

    await expect(service.create(dto, 10)).resolves.toBe(existing);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(pushNotifications.notifyNewQuote).not.toHaveBeenCalled();
  });

  it('notifies the owner after creating a new quote', async () => {
    await service.create(dto, 10);

    expect(pushNotifications.notifyNewQuote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 40, status: 'requested' }),
      30,
    );
  });

  it('blocks quoting the authenticated owners own business', async () => {
    await expect(service.create(dto, 30)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(savedRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a catalog item that is missing, inactive or no longer quotable', async () => {
    manager.findOne.mockImplementation((entity) =>
      Promise.resolve(entity === Business ? business : null),
    );

    await expect(service.create(dto, 10)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(savedRepository.save).not.toHaveBeenCalled();
  });

  it('allows only the business owner to answer a quote', async () => {
    quoteRepository.findOne.mockResolvedValue({
      id: 40,
      businessId: 20,
      userId: 10,
      status: 'requested',
    });

    await expect(
      service.respond(40, { priceClp: 15000 }, { id: 777, role: 'user' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(quoteRepository.update).not.toHaveBeenCalled();
  });

  it('allows only the requesting customer to accept a quote', async () => {
    quoteRepository.findOne.mockResolvedValue({
      id: 40,
      businessId: 20,
      userId: 10,
      status: 'quoted',
    });

    await expect(
      service.updateCustomerStatus(40, 'accepted', {
        id: 777,
        role: 'user',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(quoteRepository.update).not.toHaveBeenCalled();
  });

  it('prevents a second owner response when the state changed concurrently', async () => {
    quoteRepository.findOne.mockResolvedValue({
      id: 40,
      businessId: 20,
      userId: 10,
      status: 'requested',
    });
    quoteRepository.update.mockResolvedValue({ affected: 0 });

    await expect(
      service.respond(40, { priceClp: 15000 }, { id: 30, role: 'user' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('notifies the customer after the owner responds', async () => {
    const requested = {
      id: 40,
      businessId: 20,
      userId: 10,
      status: 'requested',
    };
    const quoted = { ...requested, status: 'quoted' };
    quoteRepository.findOne
      .mockResolvedValueOnce(requested)
      .mockResolvedValueOnce(quoted);
    quoteRepository.update.mockResolvedValue({ affected: 1 });

    await service.respond(40, { priceClp: 15000 }, { id: 30, role: 'user' });

    expect(pushNotifications.notifyQuoteResponded).toHaveBeenCalledWith(quoted);
  });

  it('notifies the owner when the customer accepts a quote', async () => {
    const quoted = {
      id: 40,
      businessId: 20,
      userId: 10,
      status: 'quoted',
    };
    const accepted = { ...quoted, status: 'accepted' };
    quoteRepository.findOne
      .mockResolvedValueOnce(quoted)
      .mockResolvedValueOnce(accepted);
    quoteRepository.update.mockResolvedValue({ affected: 1 });

    await service.updateCustomerStatus(40, 'accepted', {
      id: 10,
      role: 'user',
    });

    expect(pushNotifications.notifyQuoteStatusChanged).toHaveBeenCalledWith(
      accepted,
      30,
      'accepted',
    );
  });

  it('rejects accepting a request before the owner has quoted it', async () => {
    quoteRepository.findOne.mockResolvedValue({
      id: 40,
      businessId: 20,
      userId: 10,
      status: 'requested',
    });

    await expect(
      service.updateCustomerStatus(40, 'accepted', { id: 10, role: 'user' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
