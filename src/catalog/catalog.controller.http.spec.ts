import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { getJwtSecret } from '../auth/jwt-secret';
import { JwtStrategy } from '../auth/jwt.strategy';
import { CatalogItemKind, CatalogItemPricingMode } from './catalog-item.entity';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

describe('CatalogController HTTP contract', () => {
  const requiredDetails = {
    description: 'Descripcion del articulo',
    imageUrl:
      'https://res.cloudinary.com/zipco/image/upload/v1/catalogo/articulo.jpg',
  };
  let app: INestApplication;
  let jwtService: JwtService;
  const catalogService = {
    findPublic: jest.fn().mockResolvedValue([]),
    findManaged: jest.fn().mockResolvedValue([]),
    create: jest.fn(async (_businessId, data) => data),
    update: jest.fn(async (_businessId, _itemId, data) => data),
    updateStatus: jest.fn(async (_businessId, _itemId, isActive) => ({
      isActive,
    })),
    reorder: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: getJwtSecret() }),
      ],
      controllers: [CatalogController],
      providers: [
        JwtStrategy,
        { provide: CatalogService, useValue: catalogService },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    jwtService = module.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  const token = () =>
    jwtService.sign({ sub: 10, email: 'owner@zipco.local', role: 'user' });

  it('keeps the active public catalog available without authentication', async () => {
    await request(app.getHttpServer())
      .get('/businesses/1/catalog-items')
      .expect(200)
      .expect([]);

    expect(catalogService.findPublic).toHaveBeenCalledWith(1);
  });

  it.each([
    ['get', '/businesses/1/catalog-items/manage'],
    ['post', '/businesses/1/catalog-items'],
    ['patch', '/businesses/1/catalog-items/5'],
    ['patch', '/businesses/1/catalog-items/5/status'],
    ['put', '/businesses/1/catalog-items/order'],
  ] as const)('protects %s %s with JWT', async (method, path) => {
    await request(app.getHttpServer())[method](path).expect(401);
  });

  it('accepts the exact create contract for an authenticated owner', async () => {
    const body = {
      name: 'Torta',
      ...requiredDetails,
      kind: CatalogItemKind.PRODUCT,
      pricingMode: CatalogItemPricingMode.FIXED_PRICE,
      priceClp: 12000,
    };

    await request(app.getHttpServer())
      .post('/businesses/1/catalog-items')
      .set('Authorization', `Bearer ${token()}`)
      .send(body)
      .expect(201);

    expect(catalogService.create).toHaveBeenCalledWith(
      1,
      body,
      expect.objectContaining({ id: 10 }),
    );
  });

  it('accepts $100 and rejects $99 as the catalog price boundary', async () => {
    await request(app.getHttpServer())
      .post('/businesses/1/catalog-items')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        name: 'Articulo minimo',
        ...requiredDetails,
        kind: CatalogItemKind.PRODUCT,
        pricingMode: CatalogItemPricingMode.FIXED_PRICE,
        priceClp: 100,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/businesses/1/catalog-items')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        name: 'Articulo invalido',
        ...requiredDetails,
        kind: CatalogItemKind.PRODUCT,
        pricingMode: CatalogItemPricingMode.FIXED_PRICE,
        priceClp: 99,
      })
      .expect(400);
  });

  it('applies the same $100 minimum to an optional quote starting price', async () => {
    await request(app.getHttpServer())
      .post('/businesses/1/catalog-items')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        name: 'Servicio desde',
        ...requiredDetails,
        kind: CatalogItemKind.SERVICE,
        pricingMode: CatalogItemPricingMode.QUOTE,
        priceClp: null,
        startingPriceClp: 99,
      })
      .expect(400);
  });

  it('routes the protected management catalog to the authenticated owner', async () => {
    await request(app.getHttpServer())
      .get('/businesses/1/catalog-items/manage')
      .set('Authorization', `Bearer ${token()}`)
      .expect(200);

    expect(catalogService.findManaged).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ id: 10 }),
    );
  });

  it('routes an allowed item edit with canonical numeric IDs', async () => {
    await request(app.getHttpServer())
      .patch('/businesses/1/catalog-items/5')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Nombre actualizado' })
      .expect(200);

    expect(catalogService.update).toHaveBeenCalledWith(
      1,
      5,
      { name: 'Nombre actualizado' },
      expect.objectContaining({ id: 10 }),
    );
  });

  it('routes an explicit boolean status change', async () => {
    await request(app.getHttpServer())
      .patch('/businesses/1/catalog-items/5/status')
      .set('Authorization', `Bearer ${token()}`)
      .send({ isActive: false })
      .expect(200);

    expect(catalogService.updateStatus).toHaveBeenCalledWith(
      1,
      5,
      false,
      expect.objectContaining({ id: 10 }),
    );
  });

  it('rejects unknown fields instead of trusting the client', async () => {
    await request(app.getHttpServer())
      .post('/businesses/1/catalog-items')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        name: 'Torta',
        ...requiredDetails,
        kind: 'product',
        pricingMode: 'fixed_price',
        priceClp: 12000,
        businessId: 999,
      })
      .expect(400);

    expect(catalogService.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: '', kind: 'product', pricingMode: 'fixed_price', priceClp: 1 }],
    [{ name: '   ', kind: 'product', pricingMode: 'fixed_price', priceClp: 1 }],
    [{ name: 'A'.repeat(121), kind: 'product', pricingMode: 'view' }],
    [{ name: 'Articulo', kind: 'invalid', pricingMode: 'view' }],
    [{ name: 'Articulo', kind: 'product', pricingMode: 'invalid' }],
    [
      {
        name: 'Articulo',
        kind: 'product',
        pricingMode: 'fixed_price',
        priceClp: '12000',
      },
    ],
  ])('rejects malformed create bodies', async (body) => {
    await request(app.getHttpServer())
      .post('/businesses/1/catalog-items')
      .set('Authorization', `Bearer ${token()}`)
      .send(body)
      .expect(400);
  });

  it.each([
    [
      {
        ...requiredDetails,
        name: 'Articulo',
        kind: 'product',
        pricingMode: 'view',
        description: '',
      },
    ],
    [
      {
        ...requiredDetails,
        name: 'Articulo',
        kind: 'product',
        pricingMode: 'view',
        description: '   ',
      },
    ],
    [
      {
        ...requiredDetails,
        name: 'Articulo',
        kind: 'product',
        pricingMode: 'view',
        imageUrl: 'http://res.cloudinary.com/zipco/image/upload/item.jpg',
      },
    ],
    [
      {
        ...requiredDetails,
        name: 'Articulo',
        kind: 'product',
        pricingMode: 'view',
        imageUrl: 'https://example.com/item.jpg',
      },
    ],
    [
      {
        ...requiredDetails,
        name: 'Articulo',
        kind: 'product',
        pricingMode: 'view',
        imageUrl: null,
      },
    ],
  ])('rejects missing or unsafe required catalog details', async (body) => {
    await request(app.getHttpServer())
      .post('/businesses/1/catalog-items')
      .set('Authorization', `Bearer ${token()}`)
      .send(body)
      .expect(400);
  });

  it('keeps status and order out of the create contract', async () => {
    await request(app.getHttpServer())
      .post('/businesses/1/catalog-items')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        name: 'Torta',
        ...requiredDetails,
        kind: 'product',
        pricingMode: 'fixed_price',
        priceClp: 12000,
        isActive: false,
        displayOrder: 99,
      })
      .expect(400);
  });

  it('accepts only a boolean status', async () => {
    await request(app.getHttpServer())
      .patch('/businesses/1/catalog-items/5/status')
      .set('Authorization', `Bearer ${token()}`)
      .send({ isActive: 'false' })
      .expect(400);
  });

  it('rejects duplicate reorder IDs before calling the service', async () => {
    await request(app.getHttpServer())
      .put('/businesses/1/catalog-items/order')
      .set('Authorization', `Bearer ${token()}`)
      .send({ itemIds: [5, 5] })
      .expect(400);

    expect(catalogService.reorder).not.toHaveBeenCalled();
  });

  it('passes the complete reorder list to the service', async () => {
    await request(app.getHttpServer())
      .put('/businesses/1/catalog-items/order')
      .set('Authorization', `Bearer ${token()}`)
      .send({ itemIds: [8, 5] })
      .expect(200);

    expect(catalogService.reorder).toHaveBeenCalledWith(
      1,
      [8, 5],
      expect.objectContaining({ id: 10 }),
    );
  });
});
