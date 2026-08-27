import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Record<string, jest.Mock>;
  let queryBuilder: Record<string, jest.Mock>;

  const userWithPassword = {
    id: 1, name: 'Bastian', email: 'bastian@example.com',
    password: 'stored-password-hash', phone: '56911111111',
    location: 'Santiago', photo: 'photo.jpg',
    businessMode: false, role: 'user',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  } as User;
  const { password: _password, ...safeUser } = userWithPassword;

  beforeEach(async () => {
    queryBuilder = {
      addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    userRepository = {
      find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(),
      update: jest.fn(), delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll() removes password from every returned user', async () => {
    userRepository.find.mockResolvedValue([
      userWithPassword,
      { ...userWithPassword, id: 2, email: 'second@example.com' },
    ]);
    const result = await service.findAll();
    expect(result).toEqual([
      safeUser,
      { ...safeUser, id: 2, email: 'second@example.com' },
    ]);
    expect(result.every((user) => !('password' in user))).toBe(true);
  });

  it('findOne() removes password from the returned user', async () => {
    userRepository.findOne.mockResolvedValue(userWithPassword);
    await expect(service.findOne(1)).resolves.toEqual(safeUser);
    expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('findOne() preserves null when the user does not exist', async () => {
    userRepository.findOne.mockResolvedValue(null);
    await expect(service.findOne(999)).resolves.toBeNull();
  });

  it('findByEmail() removes password from the returned user', async () => {
    userRepository.findOne.mockResolvedValue(userWithPassword);
    const result = await service.findByEmail(userWithPassword.email);
    expect(result).toEqual(safeUser);
    expect(result).not.toHaveProperty('password');
  });

  it('findByEmail() preserves null when the user does not exist', async () => {
    userRepository.findOne.mockResolvedValue(null);
    await expect(service.findByEmail('missing@example.com')).resolves.toBeNull();
  });

  it('findByEmailWithPassword() explicitly selects password', async () => {
    queryBuilder.getOne.mockResolvedValue(userWithPassword);
    const result = await service.findByEmailWithPassword(userWithPassword.email);
    expect(result).toEqual(userWithPassword);
    expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.password');
    expect(queryBuilder.where).toHaveBeenCalledWith('user.email = :email', {
      email: userWithPassword.email,
    });
  });

  it('create() hashes password and removes it from the response', async () => {
    userRepository.create.mockImplementation((data) => data);
    userRepository.save.mockImplementation((data) =>
      Promise.resolve({ ...userWithPassword, ...data }),
    );
    const result = await service.create({
      name: 'Bastian',
      email: 'bastian@example.com',
      password: 'plain-password',
    });
    const saved = userRepository.save.mock.calls[0][0];
    await expect(bcrypt.compare('plain-password', saved.password)).resolves.toBe(true);
    expect(result).not.toHaveProperty('password');
  });

  it('update() hashes password and removes it from the response', async () => {
    userRepository.update.mockResolvedValue({ affected: 1 });
    userRepository.findOne.mockResolvedValue(userWithPassword);
    const result = await service.update(1, { password: 'new-password' });
    const updated = userRepository.update.mock.calls[0][1];
    await expect(bcrypt.compare('new-password', updated.password)).resolves.toBe(true);
    expect(result).toEqual(safeUser);
    expect(result).not.toHaveProperty('password');
  });

  it('update() preserves null when the user does not exist', async () => {
    userRepository.update.mockResolvedValue({ affected: 0 });
    userRepository.findOne.mockResolvedValue(null);
    await expect(service.update(999, { name: 'Missing' })).resolves.toBeNull();
  });
});
