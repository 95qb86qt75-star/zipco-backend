import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getJwtSecret } from '../auth/jwt-secret';
import { Business } from '../businesses/business.entity';
import { UsersModule } from '../users/users.module';
import { QaAuthController } from './qa-auth.controller';
import { isQaAuthEnabled } from './qa-environment';
import { QaAuthService } from './qa-auth.service';

@Module({})
export class QaAuthModule {
  static register(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    if (!isQaAuthEnabled(env)) return { module: QaAuthModule };
    return {
      module: QaAuthModule,
      imports: [
        TypeOrmModule.forFeature([Business]),
        JwtModule.register({ secret: getJwtSecret() }),
        UsersModule,
      ],
      controllers: [QaAuthController],
      providers: [QaAuthService],
    };
  }
}
