import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { getJwtSecret } from './jwt-secret';
import { UsersModule } from '../users/users.module';
import { VerificationCode } from './verification-code.entity';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([VerificationCode]),
    JwtModule.register({
      secret: getJwtSecret(),
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
