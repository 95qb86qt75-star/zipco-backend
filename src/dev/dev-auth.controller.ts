import { Body, Controller, Headers, Post } from '@nestjs/common';
import { DevAuthService } from './dev-auth.service';

@Controller('dev/auth')
export class DevAuthController {
  constructor(private readonly devAuthService: DevAuthService) {}

  @Post('session')
  createSession(
    @Body('account') account: unknown,
    @Headers('x-dev-auth-key') key?: string,
  ) {
    return this.devAuthService.createSession(account, key);
  }
}
