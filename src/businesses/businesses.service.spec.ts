import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Business } from './business.entity';
import { BusinessesService } from './businesses.service';
import { Category } from '../categories/category.entity';

describe('BusinessesService', () => {
  let service: BusinessesService;
  let businessRepository: {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
  };
  let categoryRepository: {
    existsBy: jest.Mock;
  };
  let queryBuilder: {
    andWhere: jest.Mock;
    addSelect: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
    getOne: jest.Mock;
    getRawAndEntities: jest.Mock;
  };

  const existingBusiness = {
    id: 1,
    name: 'Tortas Eve',
    userId: 10,
    status: 'pending',
  } as Business;

  beforeEach(async () => {
    queryBuilder = {
      andWhere: jest.fn(),
      addSelect: jest.fn(),
      orderBy: jest.fn(),
      getMany: jest.fn(),
      getOne: jest.fn(),
      getRawAndEntities: jest.fn(),
    };
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.addSelect.mockReturnValue(queryBuilder);
    queryBuilder.orderBy.mockReturnValue(queryBuilder);

    businessRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      update: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
    };
    categoryRepository = {
      existsBy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessesService,
        {
          provide: getRepositoryToken(Business),
          useValue: businessRepository,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: categoryRepository,
        },
      ],
    }).compile();

    service = module.get<BusinessesService>(BusinessesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll() returns only approved and complete businesses with an active catalog', async () => {
    const publicBusinesses = [
      {
        ...existingBusiness,
        status: 'approved',
        address: 'Calle privada 123',
        latitude: -37.0,
        longitude: -73.0,
        phone: '56911111111',
        email: 'privado@example.com',
        keywords: 'secreto interno',
        products: '[{"legacy":true}]',
        showOnlyDistance: true,
      } as Business,
    ];
    queryBuilder.getMany.mockResolvedValue(publicBusinesses);

    const result = await service.findAll();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      address: null,
      latitude: null,
      longitude: null,
      showOnlyDistance: true,
    });
    expect(result[0]).not.toHaveProperty('phone');
    expect(result[0]).not.toHaveProperty('email');
    expect(result[0]).not.toHaveProperty('keywords');
    expect(result[0]).not.toHaveProperty('products');
    expect(result[0]).not.toHaveProperty('status');
    expect(result[0]).not.toHaveProperty('createdAt');

    expect(businessRepository.createQueryBuilder).toHaveBeenCalledWith(
      'business',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('public_catalog_item."isActive" = true'),
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'business.categoryId IS NOT NULL',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('business.schedule'),
    );
  });

  it('findNearby() returns distance without exposing an exact private location', async () => {
    const privateBusiness = {
      ...existingBusiness,
      status: 'approved',
      address: 'Calle privada 123',
      latitude: -37.0,
      longitude: -73.0,
      showOnlyDistance: true,
    } as Business;
    queryBuilder.getRawAndEntities.mockResolvedValue({
      entities: [privateBusiness],
      raw: [{ distanceKm: '1.25' }],
    });

    const result = await service.findNearby(-37.01, -73.01, 10);

    expect(result[0]).toMatchObject({
      address: null,
      latitude: null,
      longitude: null,
      distanceKm: 1.25,
    });
  });

  it('findPublicOne() hides an incomplete or unpublished business', async () => {
    queryBuilder.getOne.mockResolvedValue(null);

    await expect(service.findPublicOne(1)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('business.id = :id', {
      id: 1,
    });
  });

  it('create() rejects a categoryId that does not exist', async () => {
    categoryRepository.existsBy.mockResolvedValue(false);
    await expect(
      service.create({ name: 'Negocio', categoryId: 999, userId: 10 }),
    ).rejects.toThrow('La categoría seleccionada no existe.');
    expect(businessRepository.create).not.toHaveBeenCalled();
  });

  it('create() accepts a categoryId that exists', async () => {
    const data = { name: 'Negocio', categoryId: 5, userId: 10 };
    const business = { id: 1, ...data } as Business;
    categoryRepository.existsBy.mockResolvedValue(true);
    businessRepository.create.mockReturnValue(business);
    businessRepository.save.mockResolvedValue(business);

    await expect(service.create(data)).resolves.toEqual(business);
    expect(categoryRepository.existsBy).toHaveBeenCalledWith({ id: 5 });
  });

  it('update() rejects a categoryId that does not exist', async () => {
    businessRepository.findOne.mockResolvedValue(existingBusiness);
    categoryRepository.existsBy.mockResolvedValue(false);
    await expect(
      service.update(1, { categoryId: 999 }, { id: 10, role: 'user' }),
    ).rejects.toThrow('La categoría seleccionada no existe.');
    expect(businessRepository.update).not.toHaveBeenCalled();
  });

  it('update() accepts a categoryId that exists', async () => {
    const updatedBusiness = { ...existingBusiness, categoryId: 5 };
    businessRepository.findOne
      .mockResolvedValueOnce(existingBusiness)
      .mockResolvedValueOnce(updatedBusiness);
    categoryRepository.existsBy.mockResolvedValue(true);
    businessRepository.update.mockResolvedValue({ affected: 1 });

    await expect(
      service.update(1, { categoryId: 5 }, { id: 10, role: 'user' }),
    ).resolves.toEqual(updatedBusiness);
    expect(businessRepository.update).toHaveBeenCalledWith(1, {
      categoryId: 5,
    });
  });

  it('update() throws ForbiddenException when currentUser is not owner and not admin', async () => {
    businessRepository.findOne.mockResolvedValue(existingBusiness);

    await expect(
      service.update(1, { name: 'Nuevo nombre' }, { id: 99, role: 'user' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(businessRepository.update).not.toHaveBeenCalled();
  });

  it('checks ownership before category existence', async () => {
    businessRepository.findOne.mockResolvedValue(existingBusiness);
    await expect(
      service.update(1, { categoryId: 999 }, { id: 99, role: 'user' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(categoryRepository.existsBy).not.toHaveBeenCalled();
  });

  it('update() works when currentUser is the business owner', async () => {
    const updateData = { name: 'Nuevo nombre' };
    const updatedBusiness = { ...existingBusiness, ...updateData };

    businessRepository.findOne
      .mockResolvedValueOnce(existingBusiness)
      .mockResolvedValueOnce(updatedBusiness);
    businessRepository.update.mockResolvedValue({ affected: 1 });

    await expect(
      service.update(1, updateData, { id: 10, role: 'user' }),
    ).resolves.toEqual(updatedBusiness);

    expect(businessRepository.update).toHaveBeenCalledWith(1, updateData);
  });

  it('update() works when currentUser is admin even if not the owner', async () => {
    const updateData = { description: 'Descripción actualizada' };
    const updatedBusiness = { ...existingBusiness, ...updateData };

    businessRepository.findOne
      .mockResolvedValueOnce(existingBusiness)
      .mockResolvedValueOnce(updatedBusiness);
    businessRepository.update.mockResolvedValue({ affected: 1 });

    await expect(
      service.update(1, updateData, { id: 99, role: 'admin' }),
    ).resolves.toEqual(updatedBusiness);

    expect(businessRepository.update).toHaveBeenCalledWith(1, updateData);
  });

  it('remove() throws ForbiddenException when currentUser is not owner and not admin', async () => {
    businessRepository.findOne.mockResolvedValue(existingBusiness);

    await expect(
      service.remove(1, { id: 99, role: 'user' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(businessRepository.delete).not.toHaveBeenCalled();
  });

  it('remove() works when currentUser is the business owner', async () => {
    businessRepository.findOne.mockResolvedValue(existingBusiness);
    businessRepository.delete.mockResolvedValue({ affected: 1 });

    await expect(
      service.remove(1, { id: 10, role: 'user' }),
    ).resolves.toBeUndefined();

    expect(businessRepository.delete).toHaveBeenCalledWith(1);
  });

  it('remove() works when currentUser is admin even if not the owner', async () => {
    businessRepository.findOne.mockResolvedValue(existingBusiness);
    businessRepository.delete.mockResolvedValue({ affected: 1 });

    await expect(
      service.remove(1, { id: 99, role: 'admin' }),
    ).resolves.toBeUndefined();

    expect(businessRepository.delete).toHaveBeenCalledWith(1);
  });

  it('findOne() throws NotFoundException when business does not exist', async () => {
    businessRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
