import { DataSource, EntityTarget } from 'typeorm';
import { Business } from '../businesses/business.entity';
import { Category } from '../categories/category.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { seedDevelopmentData } from './setup-dev-data';

type Row = Record<string, any>;

function fakeDataSource() {
  const stores = new Map<EntityTarget<any>, Row[]>([
    [User, []],
    [Business, []],
    [Category, []],
    [Order, []],
  ]);
  const repositories = new Map<EntityTarget<any>, any>();
  for (const [entity, rows] of stores) {
    repositories.set(entity, {
      create: (data: Row) => ({ ...data }),
      findOne: jest.fn(
        async ({ where }: { where: Row }) =>
          rows.find((row) =>
            Object.entries(where).every(([key, value]) => row[key] === value),
          ) ?? null,
      ),
      save: jest.fn(async (row: Row) => {
        if (!row.id) {
          row.id = rows.length + 1;
          rows.push(row);
        }
        return row;
      }),
    });
  }
  const manager = {
    query: jest.fn().mockResolvedValue([]),
    getRepository: (entity: EntityTarget<any>) => repositories.get(entity),
  };
  const dataSource = {
    transaction: (callback: (value: typeof manager) => unknown) =>
      callback(manager),
  } as unknown as DataSource;
  return { dataSource, stores };
}

describe('development data seed', () => {
  it('is repeatable, creates no duplicates and restores fixture states', async () => {
    const { dataSource, stores } = fakeDataSource();
    await seedDevelopmentData(dataSource, 'local-instance');
    const orders = stores.get(Order)!;
    expect(orders).toHaveLength(9);
    orders[0].status = 'completed';

    await seedDevelopmentData(dataSource, 'local-instance');

    expect(stores.get(User)).toHaveLength(4);
    expect(stores.get(Business)).toHaveLength(1);
    expect(stores.get(Category)).toHaveLength(1);
    expect(orders).toHaveLength(9);
    expect(
      orders.find((order) => order.note.startsWith('[DEV:pending]'))?.status,
    ).toBe('pending');
  });
});
