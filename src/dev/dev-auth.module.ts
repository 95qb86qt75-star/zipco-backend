import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getJwtSecret } from '../auth/jwt-secret';
import { Business } from '../businesses/business.entity';
import { UsersModule } from '../users/users.module';
import { DevAuthController } from './dev-auth.controller';
import { DevAuthService } from './dev-auth.service';
import { isDevAuthEnabled } from './dev-environment';

@Module({})
export class DevAuthModule {
  static register(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    if (!isDevAuthEnabled(env)) return { module: DevAuthModule };
    return {
      module: DevAuthModule,
      imports: [
        TypeOrmModule.forFeature([Business]),
        JwtModule.register({ secret: getJwtSecret() }),
        UsersModule,
      ],
      controllers: [DevAuthController],
      providers: [DevAuthService],
    };
  }
}
