import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(): never {
    throw new HttpException(
      'Este método de autenticación ya no está disponible. Usa el login por SMS.',
      HttpStatus.GONE,
    );
  }

  @Post('login')
  login(): never {
    throw new HttpException(
      'Este método de autenticación ya no está disponible. Usa el login por SMS.',
      HttpStatus.GONE,
    );
  }

  @Post('request-code')
  requestCode(@Body('phone') phone: string) {
    return this.authService.requestCode(phone);
  }

  @Post('verify-code')
  verifyCode(@Body() body: { phone: string; code: string }) {
    return this.authService.verifyCode(body.phone, body.code);
  }

  @Post('complete-registration')
  completeRegistration(
    @Body() body: { phone: string; code: string; name: string },
  ) {
    return this.authService.completeRegistration(body.phone, body.code, body.name);
  }
}
