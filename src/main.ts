import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import {
  assertDevAuthConfiguration,
  assertDevDatabaseMarker,
  getServerListenHost,
} from './dev/dev-environment';

async function bootstrap() {
  assertDevAuthConfiguration();
  const app = await NestFactory.create(AppModule);
  await assertDevDatabaseMarker(app.get(DataSource));
  app.enableCors({
    origin: [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'https://zipco-app.vercel.app',
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
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
