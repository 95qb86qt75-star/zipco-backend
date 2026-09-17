import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import {
  assertDevAuthConfiguration,
  assertDevDatabaseMarker,
  getServerListenHost,
} from './dev/dev-environment';
import { getCorsOrigins } from './config/cors-origins';
import {
  assertQaAuthConfiguration,
  assertQaDatabaseMarker,
} from './qa/qa-environment';

async function bootstrap() {
  assertDevAuthConfiguration();
  assertQaAuthConfiguration();
  const app = await NestFactory.create(AppModule);
  await assertDevDatabaseMarker(app.get(DataSource));
  await assertQaDatabaseMarker(app.get(DataSource));
  app.enableCors({
    origin: getCorsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });
  const listenHost = getServerListenHost();
  if (listenHost) {
    await app.listen(process.env.PORT ?? 3000, listenHost);
  } else {
    await app.listen(process.env.PORT ?? 3000);
  }
}
bootstrap();
