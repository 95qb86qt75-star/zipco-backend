import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceCatalogMinimumPrice1789357800000 implements MigrationInterface {
  name = 'EnforceCatalogMinimumPrice1789357800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "catalog_item"
      DROP CONSTRAINT "CHK_catalog_item_pricing"
    `);
    await queryRunner.query(`
      ALTER TABLE "catalog_item"
      ADD CONSTRAINT "CHK_catalog_item_pricing" CHECK (
        ("pricingMode" = 'fixed_price' AND "priceClp" IS NOT NULL AND "priceClp" >= 100 AND "startingPriceClp" IS NULL)
        OR ("pricingMode" = 'quote' AND "priceClp" IS NULL AND ("startingPriceClp" IS NULL OR "startingPriceClp" >= 100))
        OR ("pricingMode" = 'view' AND "priceClp" IS NULL AND "startingPriceClp" IS NULL)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "catalog_item"
      DROP CONSTRAINT "CHK_catalog_item_pricing"
    `);
    await queryRunner.query(`
      ALTER TABLE "catalog_item"
      ADD CONSTRAINT "CHK_catalog_item_pricing" CHECK (
        ("pricingMode" = 'fixed_price' AND "priceClp" IS NOT NULL AND "priceClp" > 0 AND "startingPriceClp" IS NULL)
        OR ("pricingMode" = 'quote' AND "priceClp" IS NULL AND ("startingPriceClp" IS NULL OR "startingPriceClp" > 0))
        OR ("pricingMode" = 'view' AND "priceClp" IS NULL AND "startingPriceClp" IS NULL)
      )
    `);
  }
}
