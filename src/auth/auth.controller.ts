import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: { name: string; email: string; password: string }) {
    return this.authService.register(body.name, body.email, body.password);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
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
