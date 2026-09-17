import 'dotenv/config';
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { VerificationCode } from '../auth/verification-code.entity';
import { Business } from '../businesses/business.entity';
import {
  CatalogItem,
  CatalogItemKind,
  CatalogItemPricingMode,
} from '../catalog/catalog-item.entity';
import { Category } from '../categories/category.entity';
import { OrderItem } from '../orders/order-item.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { QA_ACCOUNT_EMAILS } from './qa-auth.service';
import { assertQaSetupConfiguration } from './qa-environment';

async function ensureUser(
  manager: EntityManager,
  email: string,
  name: string,
  businessMode: boolean,
) {
  const repository = manager.getRepository(User);
  const existing = await repository.findOne({ where: { email } });
  const values = {
    email,
    name,
    role: 'user',
    businessMode,
    password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
  };
  return repository.save(
    existing ? Object.assign(existing, values) : repository.create(values),
  );
}

export async function seedQaData(
  dataSource: DataSource,
  instanceId: string,
): Promise<void> {
  await dataSource.transaction(async (manager) => {
    await manager.query(`CREATE TABLE IF NOT EXISTS app_environment (
      id integer PRIMARY KEY, environment_kind varchar NOT NULL, instance_id varchar NOT NULL
    )`);
    const existingMarkers: Array<{
      environment_kind: string;
      instance_id: string;
    }> = await manager.query(
      'SELECT environment_kind, instance_id FROM app_environment WHERE id = 1',
    );
    const existingMarker = existingMarkers[0];
    if (
      existingMarker &&
      (existingMarker.environment_kind !== 'qa' ||
        existingMarker.instance_id !== instanceId)
    ) {
      throw new Error(
        'La base ya tiene un marcador diferente; setup QA cancelado.',
      );
    }
    await manager.query(
      `INSERT INTO app_environment (id, environment_kind, instance_id) VALUES (1, 'qa', $1)
       ON CONFLICT (id) DO NOTHING`,
      [instanceId],
    );

    await ensureUser(manager, QA_ACCOUNT_EMAILS.customer, 'Cliente QA', false);
    const owner = await ensureUser(
      manager,
      QA_ACCOUNT_EMAILS['business-owner'],
      'Dueño de negocio QA',
      true,
    );

    const categoryRepository = manager.getRepository(Category);
    let category = await categoryRepository.findOne({
      where: { name: 'Categoría QA' },
    });
    category = await categoryRepository.save(
      category ??
        categoryRepository.create({ name: 'Categoría QA', icon: 'Store' }),
    );

    const businessRepository = manager.getRepository(Business);
    let business = await businessRepository.findOne({
      where: { userId: owner.id },
    });
    const businessValues = {
      userId: owner.id,
      name: 'ZIPCO Negocio QA',
      description: 'Negocio exclusivo para pruebas QA',
      type: 'Negocio',
      address: 'Santiago, Chile',
      latitude: -33.45,
      longitude: -70.65,
      categoryId: category.id,
      category: category.name,
      products: '[]',
      status: 'approved',
      isOpen: true,
    };
    business = await businessRepository.save(
      business
        ? Object.assign(business, businessValues)
        : businessRepository.create(businessValues),
    );

    const catalogRepository = manager.getRepository(CatalogItem);
    const existingItem = await catalogRepository.findOne({
      where: { businessId: business.id, name: 'Producto QA' },
    });
    const itemValues = {
      businessId: business.id,
      name: 'Producto QA',
      description: 'Producto para validar pedidos en QA',
      kind: CatalogItemKind.PRODUCT,
      pricingMode: CatalogItemPricingMode.FIXED_PRICE,
      priceClp: 12000,
      startingPriceClp: null,
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      isActive: true,
      displayOrder: 0,
    };
    await catalogRepository.save(
      existingItem
        ? Object.assign(existingItem, itemValues)
        : catalogRepository.create(itemValues),
    );
  });
}

async function main() {
  assertQaSetupConfiguration();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL es obligatoria para el setup QA.');
  const dataSource = new DataSource({
    type: 'postgres',
    url,
    ssl: { rejectUnauthorized: false },
    synchronize: false,
    entities: [
      Business,
      CatalogItem,
      Category,
      Order,
      OrderItem,
      User,
      VerificationCode,
    ],
  });
  await dataSource.initialize();
  try {
    await seedQaData(dataSource, process.env.QA_DATABASE_INSTANCE_ID!);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'QA setup failed.');
    process.exitCode = 1;
  });
}
