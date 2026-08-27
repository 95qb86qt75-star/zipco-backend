import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './user.entity';

export type UserResponse = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<UserResponse[]> {
    const users = await this.userRepository.find();
    return users.map((user) => this.toUserResponse(user));
  }

  async findOne(id: number): Promise<UserResponse | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    return user ? this.toUserResponse(user) : null;
  }

  async findByEmail(email: string): Promise<UserResponse | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    return user ? this.toUserResponse(user) : null;
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async create(data: Partial<User>): Promise<UserResponse> {
    const user = this.userRepository.create(await this.hashPasswordIfPresent(data));
    const savedUser = await this.userRepository.save(user);
    return this.toUserResponse(savedUser);
  }

  async update(id: number, data: Partial<User>): Promise<UserResponse | null> {
    await this.userRepository.update(id, await this.hashPasswordIfPresent(data));

    const user = await this.userRepository.findOne({ where: { id } });
    return user ? this.toUserResponse(user) : null;
  }

  async remove(id: number): Promise<void> {
    await this.userRepository.delete(id);
  }

  private toUserResponse(user: User): UserResponse {
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }

  private async hashPasswordIfPresent(data: Partial<User>): Promise<Partial<User>> {
    if (!data.password) {
      return data;
    }

    return {
      ...data,
      password: await bcrypt.hash(data.password, 10),
    };
  }
}
