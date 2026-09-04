import { INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
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
  const businessesService = {
    approve: jest.fn(),
    reject: jest.fn(),
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
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['/businesses/1/approve', '/businesses/1/reject'])(
    'rejects PATCH %s without a token',
    async (path) => {
      await request(app.getHttpServer()).patch(path).expect(401);
    },
  );
});
