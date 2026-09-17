import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { Business } from '../businesses/business.entity';
import { UsersService } from '../users/users.service';
import { QA_ACCOUNT_EMAILS, QaAuthService } from './qa-auth.service';

describe('QaAuthService', () => {
  const originalKey = process.env.QA_AUTH_KEY;
  const users = { findByEmail: jest.fn() } as unknown as UsersService;
  const jwt = {
    sign: jest.fn().mockReturnValue('qa-jwt'),
  } as unknown as JwtService;
  const businesses = { findOne: jest.fn() } as unknown as Repository<Business>;
  const service = new QaAuthService(users, jwt, businesses);

  beforeEach(() => {
    process.env.QA_AUTH_KEY = 'qa-key';
    jest.clearAllMocks();
  });
  afterAll(() => {
    process.env.QA_AUTH_KEY = originalKey;
  });

  it('rejects an invalid key before account lookup', async () => {
    await expect(
      service.createSession('customer', 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.findByEmail).not.toHaveBeenCalled();
  });

  it('accepts only the two closed QA aliases', async () => {
    await expect(
      service.createSession('admin', 'qa-key'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns a strict short-lived session for the owner', async () => {
    (users.findByEmail as jest.Mock).mockResolvedValue({
      id: 2,
      name: 'Dueño QA',
      email: QA_ACCOUNT_EMAILS['business-owner'],
      role: 'user',
    });
    (businesses.findOne as jest.Mock).mockResolvedValue({ id: 7 });
    await expect(
      service.createSession('business-owner', 'qa-key'),
    ).resolves.toEqual({
      access_token: 'qa-jwt',
      user: {
        id: 2,
        name: 'Dueño QA',
        email: QA_ACCOUNT_EMAILS['business-owner'],
        role: 'user',
      },
      businessId: 7,
    });
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ sub: 2 }), {
      expiresIn: '1h',
    });
  });
});
