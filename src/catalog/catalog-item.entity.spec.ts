import { getMetadataArgsStorage } from 'typeorm';
import {
  CatalogItem,
  CatalogItemKind,
  CatalogItemPricingMode,
} from './catalog-item.entity';

describe('CatalogItem entity', () => {
  const metadata = getMetadataArgsStorage();

  it('registers the catalog_item table and its composite index', () => {
    expect(
      metadata.tables.find((table) => table.target === CatalogItem)?.name,
    ).toBe('catalog_item');

    expect(
      metadata.indices.find(
        (index) =>
          index.target === CatalogItem &&
          index.name === 'IDX_catalog_item_business_active_order',
      )?.columns,
    ).toEqual(['businessId', 'isActive', 'displayOrder']);
  });

  it('defines the agreed catalog classifications', () => {
    expect(Object.values(CatalogItemKind)).toEqual(['product', 'service']);
    expect(Object.values(CatalogItemPricingMode)).toEqual([
      'fixed_price',
      'quote',
      'view',
    ]);
  });

  it('enforces the database checks for pricing, display order and name', () => {
    const checks = metadata.checks.filter(
      (check) => check.target === CatalogItem,
    );
    const checkNames = checks.map((check) => check.name);

    expect(checkNames).toEqual(
      expect.arrayContaining([
        'CHK_catalog_item_pricing',
        'CHK_catalog_item_display_order',
        'CHK_catalog_item_name_not_blank',
      ]),
    );
    expect(
      checks.find((check) => check.name === 'CHK_catalog_item_pricing')
        ?.expression,
    ).toContain('"priceClp" IS NOT NULL');
  });

  it('links each catalog item to its business with cascade deletion', () => {
    const relation = metadata.relations.find(
      (candidate) =>
        candidate.target === CatalogItem &&
        candidate.propertyName === 'business',
    );

    expect(relation?.relationType).toBe('many-to-one');
    expect(relation?.options).toEqual(
      expect.objectContaining({ nullable: false, onDelete: 'CASCADE' }),
    );
  });

  it('uses the agreed lengths and nullable price fields', () => {
    const columns = metadata.columns.filter(
      (column) => column.target === CatalogItem,
    );
    const column = (propertyName: string) =>
      columns.find((candidate) => candidate.propertyName === propertyName)
        ?.options;

    expect(column('name')).toEqual(expect.objectContaining({ length: 120 }));
    expect(column('description')).toEqual(
      expect.objectContaining({ length: 500, nullable: true }),
    );
    expect(column('imageUrl')).toEqual(
      expect.objectContaining({ length: 2048, nullable: true }),
    );
    expect(column('priceClp')).toEqual(
      expect.objectContaining({ type: 'integer', nullable: true }),
    );
    expect(column('startingPriceClp')).toEqual(
      expect.objectContaining({ type: 'integer', nullable: true }),
    );
  });
});
