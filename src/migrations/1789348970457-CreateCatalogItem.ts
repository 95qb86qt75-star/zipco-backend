import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalogItem1789348970457 implements MigrationInterface {
  name = 'CreateCatalogItem1789348970457';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."catalog_item_kind_enum" AS ENUM('product', 'service')
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."catalog_item_pricingmode_enum" AS ENUM('fixed_price', 'quote', 'view')
        `);
    await queryRunner.query(`
            CREATE TABLE "catalog_item" (
                "id" SERIAL NOT NULL,
                "businessId" integer NOT NULL,
                "name" character varying(120) NOT NULL,
                "description" character varying(500),
                "kind" "public"."catalog_item_kind_enum" NOT NULL,
                "pricingMode" "public"."catalog_item_pricingmode_enum" NOT NULL,
                "priceClp" integer,
                "startingPriceClp" integer,
                "imageUrl" character varying(2048),
                "isActive" boolean NOT NULL DEFAULT true,
                "displayOrder" integer NOT NULL DEFAULT '0',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_catalog_item_pricing" CHECK (
                    (
                        "pricingMode" = 'fixed_price'
                        AND "priceClp" IS NOT NULL
                        AND "priceClp" > 0
                        AND "startingPriceClp" IS NULL
                    )
                    OR (
                        "pricingMode" = 'quote'
                        AND "priceClp" IS NULL
                        AND (
                            "startingPriceClp" IS NULL
                            OR "startingPriceClp" > 0
                        )
                    )
                    OR (
                        "pricingMode" = 'view'
                        AND "priceClp" IS NULL
                        AND "startingPriceClp" IS NULL
                    )
                ),
                CONSTRAINT "CHK_catalog_item_name_not_blank" CHECK (length(btrim("name")) > 0),
                CONSTRAINT "CHK_catalog_item_display_order" CHECK ("displayOrder" >= 0),
                CONSTRAINT "PK_8996a1f608499554f35bec8601e" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_catalog_item_business_active_order" ON "catalog_item" ("businessId", "isActive", "displayOrder")
        `);
    await queryRunner.query(`
            ALTER TABLE "catalog_item"
            ADD CONSTRAINT "FK_3a0e6799dbd0603204d4f9c1d70" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "catalog_item" DROP CONSTRAINT "FK_3a0e6799dbd0603204d4f9c1d70"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_catalog_item_business_active_order"
        `);
    await queryRunner.query(`
            DROP TABLE "catalog_item"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."catalog_item_pricingmode_enum"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."catalog_item_kind_enum"
        `);
  }
}
