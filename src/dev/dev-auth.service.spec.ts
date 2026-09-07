import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { Business } from '../businesses/business.entity';
import { UsersService } from '../users/users.service';
import { DEV_ACCOUNT_EMAILS, DevAuthService } from './dev-auth.service';

describe('DevAuthService', () => {
  const originalKey = process.env.DEV_AUTH_KEY;
  const users = { findByEmail: jest.fn() } as unknown as UsersService;
  const jwt = {
    sign: jest.fn().mockReturnValue('local-jwt'),
  } as unknown as JwtService;
  const businesses = { findOne: jest.fn() } as unknown as Repository<Business>;
  const service = new DevAuthService(users, jwt, businesses);

  beforeEach(() => {
    process.env.DEV_AUTH_KEY = 'local-key';
    jest.clearAllMocks();
  });
  afterAll(() => {
    process.env.DEV_AUTH_KEY = originalKey;
  });

  it('rejects an invalid key before looking up an account', async () => {
    await expect(
      service.createSession('customer', 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects identities outside the closed alias list', async () => {
    await expect(
      service.createSession('35', 'local-key'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns the strict session contract with a short-lived backend JWT', async () => {
    (users.findByEmail as jest.Mock).mockResolvedValue({
      id: 2,
      name: 'Owner',
      email: 'dev.business-owner@zipco.local',
      role: 'user',
    });
    (businesses.findOne as jest.Mock).mockResolvedValue({ id: 7 });
    await expect(
      service.createSession('business-owner', 'local-key'),
    ).resolves.toEqual({
      access_token: 'local-jwt',
      user: {
        id: 2,
        name: 'Owner',
        email: 'dev.business-owner@zipco.local',
        role: 'user',
      },
      businessId: 7,
    });
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ sub: 2 }), {
      expiresIn: '1h',
    });
  });

  it('creates every allowed alias without invoking any SMS operation', async () => {
    const sendSms = jest.spyOn(
      AuthService.prototype as any,
      'sendVerificationSms',
    );
    const requestCode = jest.spyOn(AuthService.prototype, 'requestCode');
    const verifyCode = jest.spyOn(AuthService.prototype, 'verifyCode');
    const completeRegistration = jest.spyOn(
      AuthService.prototype,
      'completeRegistration',
    );
    const entries = Object.entries(DEV_ACCOUNT_EMAILS);
    (users.findByEmail as jest.Mock).mockImplementation(async (email) => ({
      id: entries.findIndex(([, value]) => value === email) + 1,
      name: 'Dev user',
      email,
      role: email === DEV_ACCOUNT_EMAILS.admin ? 'admin' : 'user',
    }));
    (businesses.findOne as jest.Mock).mockImplementation(async ({ where }) =>
      where.userId === 2 ? { id: 7 } : null,
    );

    for (const [account] of entries) {
      await service.createSession(account, 'local-key');
    }

    expect(users.findByEmail).toHaveBeenCalledTimes(4);
    expect(sendSms).not.toHaveBeenCalled();
    expect(requestCode).not.toHaveBeenCalled();
    expect(verifyCode).not.toHaveBeenCalled();
    expect(completeRegistration).not.toHaveBeenCalled();
  });
});
