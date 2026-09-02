import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { getJwtSecret } from '../auth/jwt-secret';
import { JwtStrategy } from '../auth/jwt.strategy';
import { User } from '../users/user.entity';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController HTTP authorization', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let categoriesService: {
    findAll: jest.Mock;
    create: jest.Mock;
    seedCategories: jest.Mock;
  };
  let userRepository: { findOne: jest.Mock };

  beforeAll(async () => {
    categoriesService = {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation((data) => Promise.resolve({ id: 1, ...data })),
      seedCategories: jest.fn().mockResolvedValue(undefined),
    };
    userRepository = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: getJwtSecret() }),
      ],
      controllers: [CategoriesController],
      providers: [
        JwtStrategy,
        { provide: CategoriesService, useValue: categoriesService },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    jwtService = module.get<JwtService>(JwtService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository.findOne.mockResolvedValue({ id: 10, role: 'user' });
  });

  afterAll(async () => {
    await app.close();
  });

  function tokenFor(id: number, role: 'user' | 'admin') {
    return jwtService.sign({
      sub: id,
      email: `${role}@example.com`,
      role,
    });
  }

  it('keeps GET /categories public', async () => {
    await request(app.getHttpServer()).get('/categories').expect(200, []);

    expect(categoriesService.findAll).toHaveBeenCalledTimes(1);
  });

  it.each(['/categories', '/categories/seed'])(
    'rejects POST %s without a token',
    async (path) => {
      await request(app.getHttpServer()).post(path).send({}).expect(401);
    },
  );

  it.each(['/categories', '/categories/seed'])(
    'rejects POST %s for a normal authenticated user',
    async (path) => {
      await request(app.getHttpServer())
        .post(path)
        .set('Authorization', `Bearer ${tokenFor(10, 'user')}`)
        .send({ name: 'Categoría falsa' })
        .expect(403);
    },
  );

  it('allows an admin to create a category', async () => {
    const category = { name: 'Comida', icon: '🍽️' };
    userRepository.findOne.mockResolvedValue({ id: 99, role: 'admin' });

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${tokenFor(99, 'user')}`)
      .send(category)
      .expect(201, { id: 1, ...category });

    expect(categoriesService.create).toHaveBeenCalledWith(category);
  });

  it('allows an admin to seed categories', async () => {
    userRepository.findOne.mockResolvedValue({ id: 99, role: 'admin' });

    await request(app.getHttpServer())
      .post('/categories/seed')
      .set('Authorization', `Bearer ${tokenFor(99, 'user')}`)
      .expect(201);

    expect(categoriesService.seedCategories).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale admin token after the database role is removed', async () => {
    userRepository.findOne.mockResolvedValue({ id: 99, role: 'user' });

    await request(app.getHttpServer())
      .post('/categories/seed')
      .set('Authorization', `Bearer ${tokenFor(99, 'admin')}`)
      .expect(403);

    expect(categoriesService.seedCategories).not.toHaveBeenCalled();
  });
});
