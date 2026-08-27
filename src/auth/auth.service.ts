import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';
import { MoreThan, MoreThanOrEqual, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { VerificationCode } from './verification-code.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(VerificationCode)
    private verificationCodeRepository: Repository<VerificationCode>,
  ) {}

  async register(name: string, email: string, password: string) {
    const user = await this.usersService.create({
      name,
      email,
      password,
    });
    return this.generateToken(user);
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new UnauthorizedException('Credenciales inválidas');

    return this.generateToken(user);
  }

  async requestCode(phone: string) {
    const normalizedPhone = this.normalizePhone(phone);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const recentRequests = await this.verificationCodeRepository.count({
      where: {
        phone: normalizedPhone,
        createdAt: MoreThanOrEqual(tenMinutesAgo),
      },
    });

    if (recentRequests >= 3) {
      throw new HttpException(
        'Has solicitado demasiados códigos. Intenta nuevamente más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const now = new Date();

    await this.verificationCodeRepository.update(
      {
        phone: normalizedPhone,
        consumed: false,
      },
      {
        consumed: true,
        consumedAt: now,
      },
    );

    const code = this.generateSixDigitCode();
    const codeHash = await bcrypt.hash(code, 10);

    const verificationCode = this.verificationCodeRepository.create({
      phone: normalizedPhone,
      codeHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      consumed: false,
      attempts: 0,
      verifiedAt: null,
      consumedAt: null,
    });

    await this.verificationCodeRepository.save(verificationCode);

    try {
      await this.sendVerificationSms(normalizedPhone, code);
    } catch (error) {
      await this.verificationCodeRepository.update(verificationCode.id, {
        consumed: true,
        consumedAt: new Date(),
      });

      throw error;
    }

    return {
      message: 'Código enviado correctamente',
    };
  }

  async verifyCode(phone: string, code: string) {
    const normalizedPhone = this.normalizePhone(phone);
    const normalizedCode = code?.replace(/\D/g, '') ?? '';

    if (normalizedCode.length !== 6) {
      throw new UnauthorizedException('Código incorrecto, verifica los dígitos');
    }

    const verificationCode = await this.verificationCodeRepository.findOne({
      where: {
        phone: normalizedPhone,
        consumed: false,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!verificationCode) {
      throw new UnauthorizedException('Tu código expiró, solicita uno nuevo');
    }

    const codeMatches = await bcrypt.compare(normalizedCode, verificationCode.codeHash);

    if (!codeMatches) {
      const attempts = verificationCode.attempts + 1;
      const shouldConsume = attempts >= 5;

      await this.verificationCodeRepository.update(verificationCode.id, {
        attempts,
        consumed: shouldConsume,
        consumedAt: shouldConsume ? new Date() : null,
      });

      throw new UnauthorizedException('Código incorrecto, verifica los dígitos');
    }

    const verifiedAt = new Date();

    await this.verificationCodeRepository.update(verificationCode.id, {
      verifiedAt,
    });

    const user = await this.usersService.findByEmail(`${normalizedPhone}@zipco.cl`);

    if (user) {
      await this.verificationCodeRepository.update(verificationCode.id, {
        consumed: true,
        consumedAt: new Date(),
        verifiedAt,
      });

      return this.generateToken(user);
    }

    return {
      needsRegistration: true,
      message: 'Código verificado correctamente. Completa tu registro.',
    };
  }

  async completeRegistration(phone: string, code: string, name: string) {
    const normalizedPhone = this.normalizePhone(phone);
    const normalizedCode = code?.replace(/\D/g, '') ?? '';

    if (normalizedCode.length !== 6) {
      throw new UnauthorizedException('Código inválido o expirado');
    }

    if (!name?.trim()) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const verificationCode = await this.verificationCodeRepository.findOne({
      where: {
        phone: normalizedPhone,
        consumed: false,
        verifiedAt: MoreThan(tenMinutesAgo),
      },
      order: {
        verifiedAt: 'DESC',
      },
    });

    if (!verificationCode) {
      throw new UnauthorizedException('Código inválido o expirado');
    }

    const codeMatches = await bcrypt.compare(normalizedCode, verificationCode.codeHash);

    if (!codeMatches) {
      throw new UnauthorizedException('Código inválido o expirado');
    }

    const email = `${normalizedPhone}@zipco.cl`;
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('El usuario ya existe');
    }

    const generatedPassword = this.generateSecurePassword();

    const user = await this.usersService.create({
      name: name.trim(),
      email,
      phone: normalizedPhone,
      password: generatedPassword,
    });

    await this.verificationCodeRepository.update(verificationCode.id, {
      consumed: true,
      consumedAt: new Date(),
    });

    return this.generateToken(user);
  }

  private normalizePhone(phone: string): string {
    if (!phone) {
      throw new BadRequestException('El teléfono es obligatorio');
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    if (/^9\d{8}$/.test(normalizedPhone)) {
      return `56${normalizedPhone}`;
    }

    if (/^569\d{8}$/.test(normalizedPhone)) {
      return normalizedPhone;
    }

    if (!normalizedPhone) {
      throw new BadRequestException('El teléfono no es válido');
    }

    throw new BadRequestException('El teléfono no es válido');
  }

  private generateSixDigitCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  private generateSecurePassword(): string {
    return randomBytes(32).toString('hex');
  }

  private async sendVerificationSms(phone: string, code: string): Promise<void> {
    const apiId = process.env.CONNECTUS_API_ID;
    const apiKey = process.env.CONNECTUS_API_KEY;

    if (!apiId || !apiKey) {
      throw new InternalServerErrorException(
        'No se pudo enviar el código, intenta nuevamente',
      );
    }

    const endpoint = 'send_individual';
    const maskedPhone = `***${phone.slice(-4)}`;
    const authToken = Buffer.from(`${apiId}:${apiKey}`).toString('base64');

    try {
      const response = await fetch(
        'https://plataforma.connectus.la/api_v3/sms/send_individual',
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            dst_number: phone,
            sms_content: `Tu código ZIPCO es ${code}`,
          }),
        },
      );
      const data = await response.json();
      const providerError = data?.error;

      if (!response.ok || providerError || !data?.id_sms) {
        console.error('connectus_sms_failed', {
          phone: maskedPhone,
          providerError:
            providerError ?? `ConnectUS response missing id_sms (status ${response.status})`,
          status: response.status,
          endpoint,
        });

        throw new Error('ConnectUS SMS delivery failed');
      }
    } catch (error) {
      if (!(error instanceof Error && error.message === 'ConnectUS SMS delivery failed')) {
        console.error('connectus_sms_failed', {
          phone: maskedPhone,
          providerError: error instanceof Error ? error.message : 'Unknown error',
          status: null,
          endpoint,
        });
      }

      throw new InternalServerErrorException(
        'No se pudo enviar el código, intenta nuevamente',
      );
    }
  }

  private generateToken(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
