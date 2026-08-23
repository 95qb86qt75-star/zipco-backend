import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: Pick<UsersService, 'findOne'>;

  beforeEach(async () => {
    usersService = {
      findOne: jest.fn().mockResolvedValue({ id: 1, email: 'user@test.com' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('allows a user to access their own profile', async () => {
    await expect(controller.findOne(1, { user: { id: 1, role: 'user' } })).resolves.toEqual({
      id: 1,
      email: 'user@test.com',
    });
  });

  it('blocks access to another user profile', () => {
    expect(() =>
      controller.findOne(2, { user: { id: 1, role: 'user' } }),
    ).toThrow('No tienes permiso para acceder a este usuario');
  });
});
