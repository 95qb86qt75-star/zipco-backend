import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category } from './category.entity';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let categoriesService: {
    findAll: jest.Mock;
    create: jest.Mock;
    seedCategories: jest.Mock;
  };
  let userRepository: { findOne: jest.Mock };

  beforeEach(async () => {
    categoriesService = {
      findAll: jest.fn(),
      create: jest.fn(),
      seedCategories: jest.fn(),
    };
    userRepository = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: categoriesService },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates findAll to the service', async () => {
    const categories = [{ id: 1, name: 'Comida', icon: 'icon' }] as Category[];
    categoriesService.findAll.mockResolvedValue(categories);

    await expect(controller.findAll()).resolves.toBe(categories);
    expect(categoriesService.findAll).toHaveBeenCalledTimes(1);
  });

  it('delegates create to the service', async () => {
    const data: Partial<Category> = { name: 'Comida', icon: 'icon' };
    const createdCategory = { id: 1, ...data } as Category;
    categoriesService.create.mockResolvedValue(createdCategory);
    userRepository.findOne.mockResolvedValue({ id: 99, role: 'admin' });

    await expect(
      controller.create(data, { user: { id: 99, role: 'user' } }),
    ).resolves.toBe(createdCategory);
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 99 },
      select: { id: true, role: true },
    });
    expect(categoriesService.create).toHaveBeenCalledWith(data);
  });

  it('blocks a user whose current database role is not admin', async () => {
    userRepository.findOne.mockResolvedValue({ id: 10, role: 'user' });

    await expect(
      controller.create(
        { name: 'Categoría falsa' },
        { user: { id: 10, role: 'admin' } },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(categoriesService.create).not.toHaveBeenCalled();
  });

  it('blocks a token whose user no longer exists', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      controller.create(
        { name: 'Categoría falsa' },
        { user: { id: 404, role: 'admin' } },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(categoriesService.create).not.toHaveBeenCalled();
  });

  it('delegates seed to the service', async () => {
    categoriesService.seedCategories.mockResolvedValue(undefined);
    userRepository.findOne.mockResolvedValue({ id: 99, role: 'admin' });

    await expect(
      controller.seed({ user: { id: 99, role: 'user' } }),
    ).resolves.toBeUndefined();
    expect(categoriesService.seedCategories).toHaveBeenCalledTimes(1);
  });

  it('blocks a normal user from seeding categories', async () => {
    userRepository.findOne.mockResolvedValue({ id: 10, role: 'user' });

    await expect(
      controller.seed({ user: { id: 10, role: 'admin' } }),
    ).rejects.toThrow(ForbiddenException);

    expect(categoriesService.seedCategories).not.toHaveBeenCalled();
  });
});
