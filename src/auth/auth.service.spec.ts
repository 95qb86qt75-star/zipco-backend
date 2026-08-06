import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { VerificationCode } from './verification-code.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    create: jest.Mock;
    findByEmail: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };
  let verificationCodeRepository: {
    count: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };

  const user = {
    id: 1,
    name: 'Bastian',
    email: '56965169255@zipco.cl',
    role: 'user',
  };
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
    };

    jwtService = {
      sign: jest.fn(),
    };

    verificationCodeRepository = {
      count: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: getRepositoryToken(VerificationCode),
          useValue: verificationCodeRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService.sign.mockReturnValue('jwt-token');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('login() throws the same generic error when the user does not exist', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login('missing@example.com', 'password'),
    ).rejects.toThrow('Credenciales inválidas');
  });

  it('login() throws the same generic error when the password is incorrect', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...user,
      password: await bcrypt.hash('correct-password', 10),
    });

    await expect(service.login(user.email, 'wrong-password')).rejects.toThrow(
      'Credenciales inválidas',
    );
  });

  it('login() returns a JWT when email and password are correct', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...user,
      password: await bcrypt.hash('correct-password', 10),
    });

    await expect(service.login(user.email, 'correct-password')).resolves.toEqual({
      access_token: 'jwt-token',
      user,
    });

    expect(usersService.findByEmail).toHaveBeenCalledWith(user.email);
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  });

  it('requestCode() creates a verification code when rate limit has not been reached', async () => {
    const verificationCode = {
      id: 10,
      phone: '56965169255',
      codeHash: 'hashed-code',
      consumed: false,
      attempts: 0,
    };

    verificationCodeRepository.count.mockResolvedValue(2);
    verificationCodeRepository.create.mockReturnValue(verificationCode);
    verificationCodeRepository.save.mockResolvedValue(verificationCode);
    jest.spyOn(service as any, 'generateSixDigitCode').mockReturnValue('123456');
    jest.spyOn(service as any, 'sendVerificationSms').mockResolvedValue(undefined);

    await expect(service.requestCode('+56 9 6516 9255')).resolves.toEqual({
      message: 'Código enviado correctamente',
    });

    expect(verificationCodeRepository.count).toHaveBeenCalledWith({
      where: {
        phone: '56965169255',
        createdAt: expect.any(Object),
      },
    });
    expect(verificationCodeRepository.update).toHaveBeenCalledWith(
      {
        phone: '56965169255',
        consumed: false,
      },
      {
        consumed: true,
        consumedAt: expect.any(Date),
      },
    );
    expect(verificationCodeRepository.create).toHaveBeenCalledWith({
      phone: '56965169255',
      codeHash: expect.any(String),
      expiresAt: expect.any(Date),
      consumed: false,
      attempts: 0,
      verifiedAt: null,
      consumedAt: null,
    });
    expect(verificationCodeRepository.save).toHaveBeenCalledWith(verificationCode);
    expect((service as any).sendVerificationSms).toHaveBeenCalledWith(
      '56965169255',
      '123456',
    );
  });

  it('requestCode() accepts a Chilean mobile number without country code and normalizes it', async () => {
    const verificationCode = {
      id: 10,
      phone: '56965169255',
      codeHash: 'hashed-code',
      consumed: false,
      attempts: 0,
    };

    verificationCodeRepository.count.mockResolvedValue(0);
    verificationCodeRepository.create.mockReturnValue(verificationCode);
    verificationCodeRepository.save.mockResolvedValue(verificationCode);
    jest.spyOn(service as any, 'generateSixDigitCode').mockReturnValue('123456');
    jest.spyOn(service as any, 'sendVerificationSms').mockResolvedValue(undefined);

    await expect(service.requestCode('965169255')).resolves.toEqual({
      message: 'Código enviado correctamente',
    });

    expect(verificationCodeRepository.count).toHaveBeenCalledWith({
      where: {
        phone: '56965169255',
        createdAt: expect.any(Object),
      },
    });
    expect((service as any).sendVerificationSms).toHaveBeenCalledWith(
      '56965169255',
      '123456',
    );
  });

  it('requestCode() accepts a Chilean mobile number with country code and spaces', async () => {
    const verificationCode = {
      id: 10,
      phone: '56965169255',
      codeHash: 'hashed-code',
      consumed: false,
      attempts: 0,
    };

    verificationCodeRepository.count.mockResolvedValue(0);
    verificationCodeRepository.create.mockReturnValue(verificationCode);
    verificationCodeRepository.save.mockResolvedValue(verificationCode);
    jest.spyOn(service as any, 'generateSixDigitCode').mockReturnValue('123456');
    jest.spyOn(service as any, 'sendVerificationSms').mockResolvedValue(undefined);

    await expect(service.requestCode('+56 9 6516 9255')).resolves.toEqual({
      message: 'Código enviado correctamente',
    });

    expect(verificationCodeRepository.count).toHaveBeenCalledWith({
      where: {
        phone: '56965169255',
        createdAt: expect.any(Object),
      },
    });
    expect((service as any).sendVerificationSms).toHaveBeenCalledWith(
      '56965169255',
      '123456',
    );
  });

  it.each(['abc1def', '12345', '569123', '569abcdef'])(
    'requestCode() rejects invalid phone format: %s',
    async (phone) => {
      await expect(service.requestCode(phone)).rejects.toThrow(
        'El teléfono no es válido',
      );

      expect(verificationCodeRepository.count).not.toHaveBeenCalled();
      expect(verificationCodeRepository.create).not.toHaveBeenCalled();
      expect(verificationCodeRepository.save).not.toHaveBeenCalled();
    },
  );

  it('requestCode() blocks after 3 requests in 10 minutes', async () => {
    verificationCodeRepository.count.mockResolvedValue(3);

    await expect(service.requestCode('+56 9 6516 9255')).rejects.toBeInstanceOf(
      HttpException,
    );

    await expect(service.requestCode('+56 9 6516 9255')).rejects.toMatchObject({
      status: 429,
    });
    expect(verificationCodeRepository.create).not.toHaveBeenCalled();
    expect(verificationCodeRepository.save).not.toHaveBeenCalled();
  });

  it('requestCode() consumes the newly created code if sending the SMS fails', async () => {
    const smsError = new Error('SMS provider failed');
    const verificationCode = {
      id: 10,
      phone: '56965169255',
      codeHash: 'hashed-code',
      consumed: false,
      attempts: 0,
    };

    verificationCodeRepository.count.mockResolvedValue(0);
    verificationCodeRepository.create.mockReturnValue(verificationCode);
    verificationCodeRepository.save.mockResolvedValue(verificationCode);
    jest.spyOn(service as any, 'generateSixDigitCode').mockReturnValue('123456');
    jest.spyOn(service as any, 'sendVerificationSms').mockRejectedValue(smsError);

    await expect(service.requestCode('+56 9 6516 9255')).rejects.toThrow(
      'SMS provider failed',
    );

    expect(verificationCodeRepository.update).toHaveBeenCalledWith(10, {
      consumed: true,
      consumedAt: expect.any(Date),
    });
  });

  it('sendVerificationSms() sends an SMS through ConnectUS when the provider returns id_sms', async () => {
    process.env.CONNECTUS_API_ID = 'api-id';
    process.env.CONNECTUS_API_KEY = 'api-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        id_sms: '505e156423f04ea0b15ab46c817f6d68',
      }),
    });
    global.fetch = fetchMock;

    await expect(
      (service as any).sendVerificationSms('56965169255', '123456'),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://plataforma.connectus.la/api_v3/sms/send_individual',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from('api-id:api-key').toString('base64')}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          dst_number: '56965169255',
          sms_content: 'Tu código ZIPCO es 123456',
        }),
      },
    );
  });

  it('sendVerificationSms() hides provider error details from the user response', async () => {
    process.env.CONNECTUS_API_ID = 'api-id';
    process.env.CONNECTUS_API_KEY = 'api-key';
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue({
        error: 'cuenta sin permiso de envío',
      }),
    });

    let thrownError: Error | undefined;

    try {
      await (service as any).sendVerificationSms('56965169255', '123456');
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError?.message).toBe(
      'No se pudo enviar el código, intenta nuevamente',
    );
    expect(thrownError?.message).not.toContain('cuenta sin permiso de envío');

    expect(consoleErrorSpy).toHaveBeenCalledWith('connectus_sms_failed', {
      phone: '***9255',
      providerError: 'cuenta sin permiso de envío',
      status: 403,
      endpoint: 'send_individual',
    });
  });

  it('sendVerificationSms() fails with a generic error when ConnectUS credentials are missing', async () => {
    delete process.env.CONNECTUS_API_ID;
    delete process.env.CONNECTUS_API_KEY;
    global.fetch = jest.fn();

    await expect(
      (service as any).sendVerificationSms('56965169255', '123456'),
    ).rejects.toThrow('No se pudo enviar el código, intenta nuevamente');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sendVerificationSms() logs network errors internally and returns a generic error', async () => {
    process.env.CONNECTUS_API_ID = 'api-id';
    process.env.CONNECTUS_API_KEY = 'api-key';
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

    await expect(
      (service as any).sendVerificationSms('56965169255', '123456'),
    ).rejects.toThrow('No se pudo enviar el código, intenta nuevamente');

    expect(consoleErrorSpy).toHaveBeenCalledWith('connectus_sms_failed', {
      phone: '***9255',
      providerError: 'ECONNRESET',
      status: null,
      endpoint: 'send_individual',
    });
  });

  it('verifyCode() returns a JWT when the code is correct and the user exists', async () => {
    const codeHash = await bcrypt.hash('123456', 10);
    const verificationCode = {
      id: 10,
      phone: '56965169255',
      codeHash,
      attempts: 0,
    };

    verificationCodeRepository.findOne.mockResolvedValue(verificationCode);
    usersService.findByEmail.mockResolvedValue(user);

    await expect(service.verifyCode('+56 9 6516 9255', '123456')).resolves.toEqual({
      access_token: 'jwt-token',
      user,
    });

    expect(usersService.findByEmail).toHaveBeenCalledWith('56965169255@zipco.cl');
    expect(verificationCodeRepository.update).toHaveBeenCalledWith(10, {
      consumed: true,
      consumedAt: expect.any(Date),
      verifiedAt: expect.any(Date),
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  });

  it('verifyCode() returns needsRegistration when the code is correct and the user does not exist', async () => {
    const codeHash = await bcrypt.hash('123456', 10);
    const verificationCode = {
      id: 10,
      phone: '56965169255',
      codeHash,
      attempts: 0,
    };

    verificationCodeRepository.findOne.mockResolvedValue(verificationCode);
    usersService.findByEmail.mockResolvedValue(null);

    await expect(service.verifyCode('+56 9 6516 9255', '123456')).resolves.toEqual({
      needsRegistration: true,
      message: 'Código verificado correctamente. Completa tu registro.',
    });

    expect(verificationCodeRepository.update).toHaveBeenCalledWith(10, {
      verifiedAt: expect.any(Date),
    });
  });

  it('verifyCode() increments attempts when the code is incorrect', async () => {
    const codeHash = await bcrypt.hash('123456', 10);
    const verificationCode = {
      id: 10,
      phone: '56965169255',
      codeHash,
      attempts: 1,
    };

    verificationCodeRepository.findOne.mockResolvedValue(verificationCode);

    await expect(service.verifyCode('+56 9 6516 9255', '999999')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(verificationCodeRepository.update).toHaveBeenCalledWith(10, {
      attempts: 2,
      consumed: false,
      consumedAt: null,
    });
  });

  it('verifyCode() throws an expired-code error when no active code exists', async () => {
    verificationCodeRepository.findOne.mockResolvedValue(null);

    await expect(service.verifyCode('+56 9 6516 9255', '123456')).rejects.toThrow(
      'Tu código expiró, solicita uno nuevo',
    );
  });

  it('completeRegistration() creates a user when a recent verified code exists', async () => {
    const codeHash = await bcrypt.hash('123456', 10);
    const verificationCode = {
      id: 10,
      phone: '56965169255',
      codeHash,
      attempts: 0,
      verifiedAt: new Date(),
      consumed: false,
    };

    verificationCodeRepository.findOne.mockResolvedValue(verificationCode);
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockResolvedValue(user);

    await expect(
      service.completeRegistration('+56 9 6516 9255', '123456', ' Bastian '),
    ).resolves.toEqual({
      access_token: 'jwt-token',
      user,
    });

    expect(usersService.create).toHaveBeenCalledWith({
      name: 'Bastian',
      email: '56965169255@zipco.cl',
      phone: '56965169255',
      password: expect.any(String),
    });
    expect(usersService.create.mock.calls[0][0].password).not.toHaveLength(0);
    expect(verificationCodeRepository.update).toHaveBeenCalledWith(10, {
      consumed: true,
      consumedAt: expect.any(Date),
    });
  });

  it('completeRegistration() throws a generic error when no recent verified code exists', async () => {
    verificationCodeRepository.findOne.mockResolvedValue(null);

    await expect(
      service.completeRegistration('+56 9 6516 9255', '123456', 'Bastian'),
    ).rejects.toThrow('Código inválido o expirado');
  });

  it('completeRegistration() throws ConflictException when the user already exists', async () => {
    const codeHash = await bcrypt.hash('123456', 10);
    const verificationCode = {
      id: 10,
      phone: '56965169255',
      codeHash,
      attempts: 0,
      verifiedAt: new Date(),
      consumed: false,
    };

    verificationCodeRepository.findOne.mockResolvedValue(verificationCode);
    usersService.findByEmail.mockResolvedValue(user);

    await expect(
      service.completeRegistration('+56 9 6516 9255', '123456', 'Bastian'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(usersService.create).not.toHaveBeenCalled();
    expect(verificationCodeRepository.update).not.toHaveBeenCalledWith(10, {
      consumed: true,
      consumedAt: expect.any(Date),
    });
  });
});
