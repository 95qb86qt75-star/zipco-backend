import { Body, Controller, Headers, Post } from '@nestjs/common';
import { QaAuthService } from './qa-auth.service';

@Controller('qa/auth')
export class QaAuthController {
  constructor(private readonly qaAuthService: QaAuthService) {}

  @Post('session')
  createSession(
    @Body('account') account: unknown,
    @Headers('x-qa-auth-key') key?: string,
  ) {
    return this.qaAuthService.createSession(account, key);
  }
}
