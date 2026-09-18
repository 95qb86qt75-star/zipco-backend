import 'dotenv/config';
import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { VerificationCode } from '../auth/verification-code.entity';
import { Business } from '../businesses/business.entity';
import { Category } from '../categories/category.entity';
import { CatalogItem } from '../catalog/catalog-item.entity';
import { Order } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { User } from '../users/user.entity';
import { PushSubscription } from '../notifications/push-subscription.entity';
import { getMigrationDatabaseConfig } from './migration-config';

const databaseConfig = getMigrationDatabaseConfig();

export default new DataSource({
  type: 'postgres',
  url: databaseConfig.url,
  ssl: databaseConfig.ssl,
  entities: [
    Business,
    CatalogItem,
    Category,
    Order,
    OrderItem,
    PushSubscription,
    User,
    VerificationCode,
  ],
  migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
  migrationsRun: false,
  migrationsTransactionMode: 'all',
  synchronize: false,
  logging: false,
});
