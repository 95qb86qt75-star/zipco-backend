import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderItem1789351697906 implements MigrationInterface {
  name = 'CreateOrderItem1789351697906';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "order_item" (
                "id" SERIAL NOT NULL,
                "orderId" integer NOT NULL,
                "catalogItemId" integer,
                "nameSnapshot" character varying(120) NOT NULL,
                "unitPriceClpSnapshot" integer NOT NULL,
                "quantity" integer NOT NULL,
                "subtotalClp" integer NOT NULL,
                CONSTRAINT "CHK_order_item_prices" CHECK (
                    "unitPriceClpSnapshot" > 0
                    AND "subtotalClp" > 0
                    AND "subtotalClp" = "unitPriceClpSnapshot" * "quantity"
                ),
                CONSTRAINT "CHK_order_item_quantity" CHECK (
                    "quantity" BETWEEN 1 AND 99
                ),
                CONSTRAINT "PK_d01158fe15b1ead5c26fd7f4e90" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_order_item_catalog_item" ON "order_item" ("catalogItemId")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_order_item_order" ON "order_item" ("orderId")
        `);
    await queryRunner.query(`
            ALTER TABLE "order_item"
            ADD CONSTRAINT "FK_646bf9ece6f45dbe41c203e06e0" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "order_item"
            ADD CONSTRAINT "FK_7c36159499160f67d1178445096" FOREIGN KEY ("catalogItemId") REFERENCES "catalog_item"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "order_item" DROP CONSTRAINT "FK_7c36159499160f67d1178445096"
        `);
    await queryRunner.query(`
            ALTER TABLE "order_item" DROP CONSTRAINT "FK_646bf9ece6f45dbe41c203e06e0"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_order_item_order"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_order_item_catalog_item"
        `);
    await queryRunner.query(`
            DROP TABLE "order_item"
        `);
  }
}
