import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Business } from '../businesses/business.entity';
import {
  CatalogItem,
  CatalogItemKind,
  CatalogItemPricingMode,
} from './catalog-item.entity';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const owner = { id: 10, role: 'user' };
  const otherUser = { id: 99, role: 'user' };
  const adminWhoIsNotOwner = { id: 99, role: 'admin' };
  const business = { id: 1, userId: owner.id } as Business;
  const fixedItem = {
    id: 5,
    businessId: business.id,
    name: 'Torta',
    kind: CatalogItemKind.PRODUCT,
    pricingMode: CatalogItemPricingMode.FIXED_PRICE,
    priceClp: 12000,
    startingPriceClp: null,
    displayOrder: 0,
    isActive: true,
  } as CatalogItem;

  let service: CatalogService;
  let catalogRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let businessRepository: { findOne: jest.Mock; existsBy: jest.Mock };
  let transactionalManager: { find: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    transactionalManager = {
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    catalogRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
      manager: {
        transaction: jest.fn(async (callback) =>
          callback(transactionalManager),
        ),
      },
    };
    businessRepository = {
      findOne: jest.fn().mockResolvedValue(business),
      existsBy: jest.fn().mockResolvedValue(true),
    };

    const module = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: getRepositoryToken(CatalogItem),
          useValue: catalogRepository,
        },
        {
          provide: getRepositoryToken(Business),
          useValue: businessRepository,
        },
      ],
    }).compile();

    service = module.get(CatalogService);
  });

  it('returns only active items to the public in display order', async () => {
    await service.findPublic(1);

    expect(catalogRepository.find).toHaveBeenCalledWith({
      where: { businessId: 1, isActive: true },
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
    expect(businessRepository.existsBy).toHaveBeenCalledWith({
      id: 1,
      status: 'approved',
    });
  });

  it('does not expose a catalog for a missing or unapproved business', async () => {
    businessRepository.existsBy.mockResolvedValue(false);

    await expect(service.findPublic(1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(catalogRepository.find).not.toHaveBeenCalled();
  });

  it('returns active and inactive items to the owner', async () => {
    await service.findManaged(1, owner);

    expect(catalogRepository.find).toHaveBeenCalledWith({
      where: { businessId: 1 },
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  });

  it.each([otherUser, adminWhoIsNotOwner])(
    'rejects catalog management by a non-owner regardless of role',
    async (currentUser) => {
      await expect(service.findManaged(1, currentUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );

  it('returns 404 when the business does not exist', async () => {
    businessRepository.findOne.mockResolvedValue(null);

    await expect(service.findManaged(404, owner)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a fixed-price item and appends it to the catalog', async () => {
    catalogRepository.findOne.mockResolvedValue({ displayOrder: 3 });

    await service.create(
      1,
      {
        name: '  Torta de chocolate  ',
        kind: CatalogItemKind.PRODUCT,
        pricingMode: CatalogItemPricingMode.FIXED_PRICE,
        priceClp: 12000,
      },
      owner,
    );

    expect(catalogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 1,
        name: 'Torta de chocolate',
        priceClp: 12000,
        startingPriceClp: null,
        displayOrder: 4,
        isActive: true,
      }),
    );
  });

  it.each([
    [CatalogItemPricingMode.FIXED_PRICE, null, null],
    [CatalogItemPricingMode.FIXED_PRICE, 0, null],
    [CatalogItemPricingMode.QUOTE, 1000, null],
    [CatalogItemPricingMode.QUOTE, null, 0],
    [CatalogItemPricingMode.VIEW, 1000, null],
  ])(
    'rejects invalid pricing mode combinations',
    async (pricingMode, priceClp, startingPriceClp) => {
      await expect(
        service.create(
          1,
          {
            name: 'Articulo',
            kind: CatalogItemKind.PRODUCT,
            pricingMode,
            priceClp,
            startingPriceClp,
          },
          owner,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(catalogRepository.save).not.toHaveBeenCalled();
    },
  );

  it('allows quote without starting price and view without prices', async () => {
    await expect(
      service.create(
        1,
        {
          name: 'Personalizado',
          kind: CatalogItemKind.SERVICE,
          pricingMode: CatalogItemPricingMode.QUOTE,
        },
        owner,
      ),
    ).resolves.toEqual(expect.objectContaining({ priceClp: null }));

    await expect(
      service.create(
        1,
        {
          name: 'Galeria',
          kind: CatalogItemKind.SERVICE,
          pricingMode: CatalogItemPricingMode.VIEW,
        },
        owner,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ priceClp: null, startingPriceClp: null }),
    );
  });

  it('returns 404 for an item outside the selected business', async () => {
    catalogRepository.findOne.mockResolvedValue(null);

    await expect(
      service.update(1, 999, { name: 'Nuevo' }, owner),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires an explicit price change when switching to fixed price', async () => {
    catalogRepository.findOne.mockResolvedValue({
      ...fixedItem,
      pricingMode: CatalogItemPricingMode.QUOTE,
      priceClp: null,
    });

    await expect(
      service.update(
        1,
        5,
        { pricingMode: CatalogItemPricingMode.FIXED_PRICE },
        owner,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates status without changing historical orders', async () => {
    catalogRepository.findOne.mockResolvedValue({ ...fixedItem });

    await expect(service.updateStatus(1, 5, false, owner)).resolves.toEqual(
      expect.objectContaining({ isActive: false }),
    );
    expect(catalogRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, isActive: false }),
    );
  });

  it('reorders the complete catalog atomically', async () => {
    transactionalManager.find.mockResolvedValue([{ id: 5 }, { id: 8 }]);

    await service.reorder(1, [8, 5], owner);

    expect(catalogRepository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(transactionalManager.update).toHaveBeenNthCalledWith(
      1,
      CatalogItem,
      { id: 8, businessId: 1 },
      { displayOrder: 0 },
    );
    expect(transactionalManager.update).toHaveBeenNthCalledWith(
      2,
      CatalogItem,
      { id: 5, businessId: 1 },
      { displayOrder: 1 },
    );
  });

  it.each([[[5]], [[5, 5]], [[5, 999]]])(
    'rejects incomplete, duplicate or foreign reorder lists',
    async (ids) => {
      transactionalManager.find.mockResolvedValue([{ id: 5 }, { id: 8 }]);

      await expect(service.reorder(1, ids, owner)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(transactionalManager.update).not.toHaveBeenCalled();
    },
  );
});
