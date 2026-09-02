import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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

  beforeEach(async () => {
    categoriesService = {
      findAll: jest.fn(),
      create: jest.fn(),
      seedCategories: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: categoriesService }],
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

    await expect(
      controller.create(data, { user: { id: 99, role: 'admin' } }),
    ).resolves.toBe(createdCategory);
    expect(categoriesService.create).toHaveBeenCalledWith(data);
  });

  it('blocks a normal user from creating a category', () => {
    expect(() =>
      controller.create(
        { name: 'Categoría falsa' },
        { user: { id: 10, role: 'user' } },
      ),
    ).toThrow(ForbiddenException);

    expect(categoriesService.create).not.toHaveBeenCalled();
  });

  it('delegates seed to the service', async () => {
    categoriesService.seedCategories.mockResolvedValue(undefined);

    await expect(
      controller.seed({ user: { id: 99, role: 'admin' } }),
    ).resolves.toBeUndefined();
    expect(categoriesService.seedCategories).toHaveBeenCalledTimes(1);
  });

  it('blocks a normal user from seeding categories', () => {
    expect(() => controller.seed({ user: { id: 10, role: 'user' } })).toThrow(
      ForbiddenException,
    );

    expect(categoriesService.seedCategories).not.toHaveBeenCalled();
  });
});
