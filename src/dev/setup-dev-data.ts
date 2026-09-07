import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager } from 'typeorm';
import { VerificationCode } from '../auth/verification-code.entity';
import { Business } from '../businesses/business.entity';
import { Category } from '../categories/category.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import {
  assertDevAuthConfiguration,
  assertSafeDevDatabaseUrl,
  isDevAuthEnabled,
} from './dev-environment';
import { DEV_ACCOUNT_EMAILS } from './dev-auth.service';

const PRODUCT = JSON.stringify([
  {
    id: 'dev-product-1',
    name: 'Producto de prueba ZIPCO',
    description: 'Producto local',
    price: 3800,
    mode: 'order',
    imageUrl: '',
  },
]);
const ORDER_PRODUCTS = JSON.stringify([
  { name: 'Producto de prueba ZIPCO', price: 3800, quantity: 1 },
]);

async function ensureUser(
  manager: EntityManager,
  email: string,
  name: string,
  role = 'user',
) {
  const repository = manager.getRepository(User);
  const existing = await repository.findOne({ where: { email } });
  if (existing) {
    existing.name = name;
    existing.role = role;
    existing.businessMode = email === DEV_ACCOUNT_EMAILS['business-owner'];
    return repository.save(existing);
  }
  const user = repository.create({
    email,
    name,
    role,
    businessMode: email === DEV_ACCOUNT_EMAILS['business-owner'],
    password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
  });
  return repository.save(user);
}

function calendarDate(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export async function seedDevelopmentData(
  dataSource: DataSource,
  instanceId: string,
): Promise<void> {
  await dataSource.transaction(async (manager) => {
    await manager.query(`CREATE TABLE IF NOT EXISTS app_environment (
      id integer PRIMARY KEY, environment_kind varchar NOT NULL, instance_id varchar NOT NULL
    )`);
    await manager.query(
      `INSERT INTO app_environment (id, environment_kind, instance_id) VALUES (1, 'development', $1)
       ON CONFLICT (id) DO UPDATE SET environment_kind = EXCLUDED.environment_kind, instance_id = EXCLUDED.instance_id`,
      [instanceId],
    );

    const customer = await ensureUser(
      manager,
      DEV_ACCOUNT_EMAILS.customer,
      'Cliente de prueba',
    );
    const owner = await ensureUser(
      manager,
      DEV_ACCOUNT_EMAILS['business-owner'],
      'Dueño de prueba',
    );
    await ensureUser(
      manager,
      DEV_ACCOUNT_EMAILS['unrelated-user'],
      'Tercero de prueba',
    );
    await ensureUser(
      manager,
      DEV_ACCOUNT_EMAILS.admin,
      'Admin de prueba',
      'admin',
    );

    const categoryRepository = manager.getRepository(Category);
    let category = await categoryRepository.findOne({
      where: { name: 'Categoría de desarrollo' },
    });
    if (!category) {
      category = categoryRepository.create({
        name: 'Categoría de desarrollo',
        icon: 'Store',
      });
    }
    category.icon = 'Store';
    category = await categoryRepository.save(category);

    const businessRepository = manager.getRepository(Business);
    let business = await businessRepository.findOne({
      where: { userId: owner.id },
    });
    const businessData = {
      userId: owner.id,
      name: 'ZIPCO Negocio Local',
      description: 'Negocio exclusivo de desarrollo',
      type: 'Negocio',
      address: 'Dirección local de prueba',
      latitude: -33.45,
      longitude: -70.65,
      categoryId: category.id,
      category: category.name,
      products: PRODUCT,
      status: 'approved',
      isOpen: true,
    };
    business = await businessRepository.save(
      business
        ? Object.assign(business, businessData)
        : businessRepository.create(businessData),
    );

    const fixtures = [
      {
        key: 'pending',
        status: 'pending',
        needNow: false,
        deliveryDate: calendarDate(1),
      },
      {
        key: 'accepted-today',
        status: 'accepted',
        needNow: true,
        deliveryDate: null,
      },
      {
        key: 'accepted-tomorrow',
        status: 'accepted',
        needNow: false,
        deliveryDate: calendarDate(1),
      },
      {
        key: 'accepted-upcoming',
        status: 'accepted',
        needNow: false,
        deliveryDate: calendarDate(3),
      },
      {
        key: 'accepted-no-date',
        status: 'accepted',
        needNow: false,
        deliveryDate: null,
      },
      {
        key: 'ready',
        status: 'ready',
        needNow: false,
        deliveryDate: calendarDate(1),
      },
      {
        key: 'completed',
        status: 'completed',
        needNow: false,
        deliveryDate: calendarDate(-1),
      },
      {
        key: 'rejected',
        status: 'rejected',
        needNow: false,
        deliveryDate: calendarDate(1),
      },
      {
        key: 'cancelled',
        status: 'cancelled',
        needNow: false,
        deliveryDate: calendarDate(1),
        cancellationReason: 'selected_by_mistake',
      },
    ];
    const orderRepository = manager.getRepository(Order);
    for (const fixture of fixtures) {
      const note = `[DEV:${fixture.key}] Pedido local de prueba`;
      const existing = await orderRepository.findOne({
        where: { businessId: business.id, userId: customer.id, note },
      });
      const orderData = {
        businessId: business.id,
        userId: customer.id,
        customerName: customer.name,
        products: ORDER_PRODUCTS,
        note,
        needNow: fixture.needNow,
        deliveryDate: fixture.deliveryDate ?? undefined,
        deliveryTime: fixture.deliveryDate ? '13:30' : undefined,
        total: 3800,
        status: fixture.status,
        cancellationReason: fixture.cancellationReason ?? undefined,
      };
      await orderRepository.save(
        existing
          ? Object.assign(existing, orderData)
          : orderRepository.create(orderData),
      );
    }
  });
}

async function main() {
  if (!isDevAuthEnabled())
    throw new Error(
      'Dev setup requires NODE_ENV=development and ENABLE_DEV_AUTH=true.',
    );
  assertDevAuthConfiguration();
  const url = process.env.DATABASE_URL ?? '';
  assertSafeDevDatabaseUrl(url);
  const dataSource = new DataSource({
    type: 'postgres',
    url,
    ssl: false,
    synchronize: false,
    entities: [Business, Category, Order, User, VerificationCode],
  });
  await dataSource.initialize();
  try {
    await seedDevelopmentData(
      dataSource,
      process.env.DEV_DATABASE_INSTANCE_ID!,
    );
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Dev setup failed.');
    process.exitCode = 1;
  });
}
