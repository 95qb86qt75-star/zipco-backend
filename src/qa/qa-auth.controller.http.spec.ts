import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { QaAuthController } from './qa-auth.controller';
import { QaAuthModule } from './qa-auth.module';

describe('QA auth route availability', () => {
  let app: INestApplication;
  afterEach(async () => {
    if (app) await app.close();
  });

  it('registers without the SMS authentication module only for exact QA configuration', () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    const definition = QaAuthModule.register({
      NODE_ENV: 'production',
      APP_ENVIRONMENT: 'qa',
      ENABLE_QA_AUTH: 'true',
    });
    expect(definition.controllers).toContain(QaAuthController);
    expect(definition.imports).not.toContain(AuthModule);
  });

  it.each([
    {
      NODE_ENV: 'production',
      APP_ENVIRONMENT: 'production',
      ENABLE_QA_AUTH: 'true',
    },
    { NODE_ENV: 'development', APP_ENVIRONMENT: 'qa', ENABLE_QA_AUTH: 'true' },
    { NODE_ENV: 'production', APP_ENVIRONMENT: 'qa', ENABLE_QA_AUTH: 'false' },
    {
      NODE_ENV: 'production',
      APP_ENVIRONMENT: 'qa',
      ENABLE_QA_AUTH: undefined,
    },
  ])('returns 404 outside the exact QA gate', async (env) => {
    const module = await Test.createTestingModule({
      imports: [QaAuthModule.register(env)],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    await request(app.getHttpServer())
      .post('/qa/auth/session')
      .send({ account: 'customer' })
      .expect(404);
  });
});
