import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Business } from './business.entity';
import { BusinessesService } from './businesses.service';

describe('BusinessesService', () => {
  let service: BusinessesService;
  let businessRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    query: jest.Mock;
  };

  const existingBusiness = {
    id: 1,
    name: 'Tortas Eve',
    userId: 10,
    status: 'pending',
  } as Business;

  beforeEach(async () => {
    businessRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessesService,
        {
          provide: getRepositoryToken(Business),
          useValue: businessRepository,
        },
      ],
    }).compile();

    service = module.get<BusinessesService>(BusinessesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('update() throws ForbiddenException when currentUser is not owner and not admin', async () => {
    businessRepository.findOne.mockResolvedValue(existingBusiness);

    await expect(
      service.update(1, { name: 'Nuevo nombre' }, { id: 99, role: 'user' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(businessRepository.update).not.toHaveBeenCalled();
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

    await expect(service.remove(1, { id: 99, role: 'user' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(businessRepository.delete).not.toHaveBeenCalled();
  });

  it('remove() works when currentUser is the business owner', async () => {
    businessRepository.findOne.mockResolvedValue(existingBusiness);
    businessRepository.delete.mockResolvedValue({ affected: 1 });

    await expect(service.remove(1, { id: 10, role: 'user' })).resolves.toBeUndefined();

    expect(businessRepository.delete).toHaveBeenCalledWith(1);
  });

  it('remove() works when currentUser is admin even if not the owner', async () => {
    businessRepository.findOne.mockResolvedValue(existingBusiness);
    businessRepository.delete.mockResolvedValue({ affected: 1 });

    await expect(service.remove(1, { id: 99, role: 'admin' })).resolves.toBeUndefined();

    expect(businessRepository.delete).toHaveBeenCalledWith(1);
  });

  it('findOne() throws NotFoundException when business does not exist', async () => {
    businessRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});
