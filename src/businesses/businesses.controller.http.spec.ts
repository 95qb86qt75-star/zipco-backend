import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { getJwtSecret } from '../auth/jwt-secret';
import { JwtStrategy } from '../auth/jwt.strategy';
import { User } from '../users/user.entity';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

describe('BusinessesController HTTP authorization', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const businessesService = {
    approve: jest.fn(),
    reject: jest.fn(),
    findPending: jest.fn().mockResolvedValue([{ id: 1, status: 'pending' }]),
    findNearby: jest.fn().mockResolvedValue([]),
  };
  const userRepository = {
    findOne: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: getJwtSecret() }),
      ],
      controllers: [BusinessesController],
      providers: [
        JwtStrategy,
        { provide: BusinessesService, useValue: businessesService },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    jwtService = module.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects public searches shorter than three characters', async () => {
    await request(app.getHttpServer())
      .get('/businesses/nearby?lat=-33.45&lng=-70.66&radius=10&search=Ev')
      .expect(400);
    expect(businessesService.findNearby).not.toHaveBeenCalled();
  });

  it('trims and forwards a valid public search', async () => {
    await request(app.getHttpServer())
      .get(
        '/businesses/nearby?lat=-33.45&lng=-70.66&radius=10&search=%20tortas%20',
      )
      .expect(200);
    expect(businessesService.findNearby).toHaveBeenCalledWith(
      -33.45,
      -70.66,
      10,
      undefined,
      'tortas',
    );
  });

  it.each(['/businesses/1/approve', '/businesses/1/reject'])(
    'rejects PATCH %s without a token',
    async (path) => {
      await request(app.getHttpServer()).patch(path).expect(401);
    },
  );

  it('rejects GET /businesses/pending without a token', async () => {
    await request(app.getHttpServer()).get('/businesses/pending').expect(401);
  });

  it('rejects GET /businesses/pending for a current non-admin', async () => {
    userRepository.findOne.mockResolvedValue({ id: 10, role: 'user' });
    const token = jwtService.sign({ sub: 10, role: 'user' });

    await request(app.getHttpServer())
      .get('/businesses/pending')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('rejects a stale admin token for GET /businesses/pending', async () => {
    userRepository.findOne.mockResolvedValue({ id: 10, role: 'user' });
    const token = jwtService.sign({ sub: 10, role: 'admin' });

    await request(app.getHttpServer())
      .get('/businesses/pending')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('allows a current database admin to GET /businesses/pending', async () => {
    userRepository.findOne.mockResolvedValue({ id: 99, role: 'admin' });
    const token = jwtService.sign({ sub: 99, role: 'user' });

    await request(app.getHttpServer())
      .get('/businesses/pending')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([{ id: 1, status: 'pending' }]);
  });
});
