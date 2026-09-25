import { QueryRunner } from 'typeorm';
import { CreateOrderCreationAttempt1789900000000 } from './1789900000000-CreateOrderCreationAttempt';

describe('CreateOrderCreationAttempt1789900000000', () => {
  it('creates the database guarantees required for idempotent orders', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new CreateOrderCreationAttempt1789900000000();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('"order_creation_attempt"');
    expect(sql).toContain('"UQ_order_creation_attempt_user_key"');
    expect(sql).toContain('UNIQUE ("userId", "idempotencyKey")');
    expect(sql).toContain('UNIQUE ("orderId")');
    expect(sql).toContain('ON DELETE CASCADE');
  });

  it('removes only the idempotency table when reverted', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new CreateOrderCreationAttempt1789900000000();

    await migration.down({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenCalledWith('DROP TABLE "order_creation_attempt"');
  });
});
