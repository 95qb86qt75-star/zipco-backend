import 'dotenv/config';
import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { VerificationCode } from '../auth/verification-code.entity';
import { Business } from '../businesses/business.entity';
import { Category } from '../categories/category.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { getMigrationDatabaseConfig } from './migration-config';

const databaseConfig = getMigrationDatabaseConfig();

export default new DataSource({
  type: 'postgres',
  url: databaseConfig.url,
  ssl: databaseConfig.ssl,
  entities: [Business, Category, Order, User, VerificationCode],
  migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
  migrationsRun: false,
  migrationsTransactionMode: 'all',
  synchronize: false,
  logging: false,
});
