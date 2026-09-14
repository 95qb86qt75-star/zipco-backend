import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { getJwtSecret } from '../auth/jwt-secret';
import { JwtStrategy } from '../auth/jwt.strategy';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('POST /orders secure HTTP contract', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const ordersService = {
    create: jest.fn().mockResolvedValue({ id: 1, status: 'pending' }),
    findMyOrders: jest.fn(),
    findByBusiness: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: getJwtSecret() }),
      ],
      controllers: [OrdersController],
      providers: [
        JwtStrategy,
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    jwtService = module.get(JwtService);
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  const token = () =>
    jwtService.sign({ sub: 10, email: 'customer@zipco.local', role: 'user' });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send({ businessId: 20, items: [{ catalogItemId: 5, quantity: 1 }] })
      .expect(401);
  });

  it('accepts only catalog item IDs and quantities', async () => {
    const body = {
      businessId: 20,
      items: [{ catalogItemId: 5, quantity: 2 }],
      note: 'Para manana',
      needNow: false,
      deliveryDate: '2026-09-20',
      deliveryTime: '13:30',
      referencePhoto: null,
    };

    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token()}`)
      .send(body)
      .expect(201)
      .expect({ id: 1, status: 'pending' });

    expect(ordersService.create).toHaveBeenCalledWith(body, 10);
  });

  it.each([
    ['products', '[]'],
    ['total', 1],
    ['status', 'completed'],
    ['userId', 999],
    ['customerName', 'Manipulado'],
    ['customerPhone', '+56900000000'],
  ])('rejects the legacy or internal field %s', async (field, value) => {
    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        businessId: 20,
        items: [{ catalogItemId: 5, quantity: 1 }],
        [field]: value,
      })
      .expect(400);

    expect(ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    [[{ catalogItemId: 5, quantity: 0 }]],
    [[{ catalogItemId: 5, quantity: 100 }]],
    [[{ catalogItemId: '5', quantity: 1 }]],
    [[{ catalogItemId: 5, quantity: '1' }]],
    [
      [
        { catalogItemId: 5, quantity: 1 },
        { catalogItemId: 5, quantity: 2 },
      ],
    ],
    [[]],
  ])('rejects invalid item lists', async (items) => {
    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token()}`)
      .send({ businessId: 20, items })
      .expect(400);
  });

  it('rejects more than 20 distinct lines', async () => {
    const items = Array.from({ length: 21 }, (_, index) => ({
      catalogItemId: index + 1,
      quantity: 1,
    }));

    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token()}`)
      .send({ businessId: 20, items })
      .expect(400);
  });

  it.each([
    [{ note: 'N'.repeat(301) }],
    [{ deliveryDate: '20-09-2026' }],
    [{ deliveryTime: '25:99' }],
    [{ needNow: 'false' }],
  ])('rejects malformed order details', async (extraFields) => {
    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        businessId: 20,
        items: [{ catalogItemId: 5, quantity: 1 }],
        ...extraFields,
      })
      .expect(400);
  });
});
