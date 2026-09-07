import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { DevAuthModule } from './dev-auth.module';

describe('development auth route availability', () => {
  let app: INestApplication;
  afterEach(async () => {
    if (app) await app.close();
  });

  it('does not import the SMS authentication module when enabled', () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    const definition = DevAuthModule.register({
      NODE_ENV: 'development',
      ENABLE_DEV_AUTH: 'true',
    });
    expect(definition.imports).not.toContain(AuthModule);
  });

  it.each(['production', 'test'])(
    'returns 404 when NODE_ENV=%s',
    async (nodeEnv) => {
      const module = await Test.createTestingModule({
        imports: [
          DevAuthModule.register({
            NODE_ENV: nodeEnv,
            ENABLE_DEV_AUTH: 'true',
          }),
        ],
      }).compile();
      app = module.createNestApplication();
      await app.init();
      await request(app.getHttpServer())
        .post('/dev/auth/session')
        .send({ account: 'customer' })
        .expect(404);
    },
  );

  it.each([false, undefined])(
    'returns 404 in development when ENABLE_DEV_AUTH=%s',
    async (enabled) => {
      const module = await Test.createTestingModule({
        imports: [
          DevAuthModule.register({
            NODE_ENV: 'development',
            ENABLE_DEV_AUTH: enabled === false ? 'false' : undefined,
          }),
        ],
      }).compile();
      app = module.createNestApplication();
      await app.init();
      await request(app.getHttpServer())
        .post('/dev/auth/session')
        .send({ account: 'customer' })
        .expect(404);
    },
  );
});
