import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { Category } from './category.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoryRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    categoryRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: categoryRepository,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns all categories', async () => {
    const categories = [{ id: 1, name: 'Comida', icon: 'icon' }] as Category[];
    categoryRepository.find.mockResolvedValue(categories);

    await expect(service.findAll()).resolves.toBe(categories);
    expect(categoryRepository.find).toHaveBeenCalledTimes(1);
  });

  it('creates and saves a category', async () => {
    const data: Partial<Category> = { name: 'Comida', icon: 'icon' };
    const category = { id: 1, ...data } as Category;
    categoryRepository.create.mockReturnValue(category);
    categoryRepository.save.mockResolvedValue(category);

    await expect(service.create(data)).resolves.toBe(category);
    expect(categoryRepository.create).toHaveBeenCalledWith(data);
    expect(categoryRepository.save).toHaveBeenCalledWith(category);
  });

  it('does not recreate an existing category and creates missing categories', async () => {
    categoryRepository.findOne
      .mockResolvedValueOnce({ id: 1 } as Category)
      .mockResolvedValue(null);
    categoryRepository.create.mockImplementation((data: Partial<Category>) => data);
    categoryRepository.save.mockImplementation((category: Category) =>
      Promise.resolve(category),
    );

    await service.seedCategories();

    expect(categoryRepository.findOne).toHaveBeenCalledTimes(10);
    expect(categoryRepository.create).toHaveBeenCalledTimes(9);
    expect(categoryRepository.save).toHaveBeenCalledTimes(9);

    const firstCategoryName = categoryRepository.findOne.mock.calls[0][0].where.name;
    expect(categoryRepository.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: firstCategoryName }),
    );
  });
});
