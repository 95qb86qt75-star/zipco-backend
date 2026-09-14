import { getMetadataArgsStorage } from 'typeorm';
import { OrderItem } from './order-item.entity';

describe('OrderItem entity', () => {
  const metadata = getMetadataArgsStorage();

  it('registers the order_item table with its two indexes', () => {
    expect(
      metadata.tables.find((table) => table.target === OrderItem)?.name,
    ).toBe('order_item');
    const indexNames = metadata.indices
      .filter((index) => index.target === OrderItem)
      .map((index) => index.name);
    expect(indexNames).toEqual(
      expect.arrayContaining([
        'IDX_order_item_order',
        'IDX_order_item_catalog_item',
      ]),
    );
  });

  it('keeps the order and catalog deletion rules independent', () => {
    const relations = metadata.relations.filter(
      (relation) => relation.target === OrderItem,
    );
    expect(
      relations.find((relation) => relation.propertyName === 'order')?.options,
    ).toEqual(
      expect.objectContaining({ onDelete: 'CASCADE', nullable: false }),
    );
    expect(
      relations.find((relation) => relation.propertyName === 'catalogItem')
        ?.options,
    ).toEqual(
      expect.objectContaining({ onDelete: 'SET NULL', nullable: true }),
    );
  });

  it('enforces quantity and positive historical prices', () => {
    const checks = metadata.checks.filter(
      (check) => check.target === OrderItem,
    );
    const checkNames = checks.map((check) => check.name);
    expect(checkNames).toEqual(
      expect.arrayContaining([
        'CHK_order_item_quantity',
        'CHK_order_item_prices',
      ]),
    );
    expect(
      checks.find((check) => check.name === 'CHK_order_item_prices')
        ?.expression,
    ).toContain('"subtotalClp" = "unitPriceClpSnapshot" * "quantity"');
  });
});
