import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: Pick<UsersService, 'findOne' | 'update'>;

  beforeEach(async () => {
    usersService = {
      findOne: jest.fn().mockResolvedValue({ id: 1, email: 'user@test.com' }),
      update: jest.fn(),
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

  it('blocks updating another user profile', () => {
    expect(() =>
      controller.update(2, {}, { user: { id: 1, role: 'user' } }),
    ).toThrow('No tienes permiso para acceder a este usuario');
  });

  it('blocks deleting another user profile', () => {
    expect(() =>
      controller.remove(2, { user: { id: 1, role: 'user' } }),
    ).toThrow('No tienes permiso para acceder a este usuario');
  });

  it('passes only profile fields to the service when updating a user', () => {
    const unsafePayload = {
      name: 'Maria',
      location: 'Coronel',
      photo: 'https://example.com/photo.jpg',
      phone: '56999999999',
      email: 'attacker@example.com',
      password: 'unsafe',
      role: 'admin',
      id: 999,
      createdAt: new Date(),
      businessMode: true,
    } as unknown as UpdateUserDto;

    controller.update(1, unsafePayload, { user: { id: 1, role: 'user' } });

    expect(usersService.update).toHaveBeenCalledWith(1, {
      name: 'Maria',
      location: 'Coronel',
      photo: 'https://example.com/photo.jpg',
    });
  });
});
