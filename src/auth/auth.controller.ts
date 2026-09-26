import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
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

  @Post('change-phone/request-code')
  @UseGuards(AuthGuard('jwt'))
  requestPhoneChange(@Body('phone') phone: string, @Request() req) {
    return this.authService.requestPhoneChange(req.user.id, phone);
  }

  @Post('change-phone/confirm')
  @UseGuards(AuthGuard('jwt'))
  confirmPhoneChange(
    @Body() body: { phone: string; code: string },
    @Request() req,
  ) {
    return this.authService.confirmPhoneChange(req.user.id, body.phone, body.code);
  }
}
