import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    requestCode: jest.Mock;
    verifyCode: jest.Mock;
    completeRegistration: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      requestCode: jest.fn(),
      verifyCode: jest.fn(),
      completeRegistration: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('register() delegates to AuthService', () => {
    const response = { access_token: 'jwt-token' };
    authService.register.mockReturnValue(response);

    expect(
      controller.register({
        name: 'Bastian',
        email: 'bastian@example.com',
        password: 'password',
      }),
    ).toBe(response);
    expect(authService.register).toHaveBeenCalledWith(
      'Bastian',
      'bastian@example.com',
      'password',
    );
  });

  it('login() delegates to AuthService', () => {
    const response = { access_token: 'jwt-token' };
    authService.login.mockReturnValue(response);

    expect(
      controller.login({
        email: 'bastian@example.com',
        password: 'password',
      }),
    ).toBe(response);
    expect(authService.login).toHaveBeenCalledWith('bastian@example.com', 'password');
  });

  it('requestCode() delegates to AuthService', () => {
    const response = { message: 'Código enviado correctamente' };
    authService.requestCode.mockReturnValue(response);

    expect(controller.requestCode('+56 9 6516 9255')).toBe(response);
    expect(authService.requestCode).toHaveBeenCalledWith('+56 9 6516 9255');
  });

  it('verifyCode() delegates to AuthService', () => {
    const response = { needsRegistration: true };
    authService.verifyCode.mockReturnValue(response);

    expect(
      controller.verifyCode({
        phone: '+56 9 6516 9255',
        code: '123456',
      }),
    ).toBe(response);
    expect(authService.verifyCode).toHaveBeenCalledWith('+56 9 6516 9255', '123456');
  });

  it('completeRegistration() delegates to AuthService', () => {
    const response = { access_token: 'jwt-token' };
    authService.completeRegistration.mockReturnValue(response);

    expect(
      controller.completeRegistration({
        phone: '+56 9 6516 9255',
        code: '123456',
        name: 'Bastian',
      }),
    ).toBe(response);
    expect(authService.completeRegistration).toHaveBeenCalledWith(
      '+56 9 6516 9255',
      '123456',
      'Bastian',
    );
  });
});
