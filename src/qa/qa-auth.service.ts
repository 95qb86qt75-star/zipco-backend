import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { Business } from '../businesses/business.entity';
import { UsersService } from '../users/users.service';

export const QA_ACCOUNT_EMAILS = {
  customer: 'qa.customer@zipco.test',
  'business-owner': 'qa.business-owner@zipco.test',
} as const;
export type QaAccount = keyof typeof QA_ACCOUNT_EMAILS;

@Injectable()
export class QaAuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async createSession(account: unknown, suppliedKey: string | undefined) {
    this.verifyKey(suppliedKey);
    if (typeof account !== 'string' || !(account in QA_ACCOUNT_EMAILS)) {
      throw new BadRequestException('Cuenta QA no permitida.');
    }
    const user = await this.usersService.findByEmail(
      QA_ACCOUNT_EMAILS[account as QaAccount],
    );
    if (!user) throw new BadRequestException('Ejecuta primero el setup QA.');
    const business = await this.businessRepository.findOne({
      where: { userId: user.id },
      select: { id: true },
    });
    return {
      access_token: this.jwtService.sign(
        { sub: user.id, email: user.email, role: user.role },
        { expiresIn: '1h' },
      ),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      businessId: business?.id ?? null,
    };
  }

  private verifyKey(suppliedKey: string | undefined): void {
    const expectedBuffer = Buffer.from(process.env.QA_AUTH_KEY ?? '');
    const suppliedBuffer = Buffer.from(suppliedKey ?? '');
    if (
      !expectedBuffer.length ||
      expectedBuffer.length !== suppliedBuffer.length ||
      !timingSafeEqual(expectedBuffer, suppliedBuffer)
    ) {
      throw new UnauthorizedException('Acceso QA no autorizado.');
    }
  }
}
