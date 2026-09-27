import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuoteRequest1790470000000 implements MigrationInterface {
  name = 'CreateQuoteRequest1790470000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "quote_request" ("id" SERIAL NOT NULL, "businessId" integer NOT NULL, "catalogItemId" integer NOT NULL, "userId" integer NOT NULL, "customerName" character varying(120) NOT NULL, "customerPhone" character varying(30), "itemNameSnapshot" character varying(120) NOT NULL, "itemDescriptionSnapshot" character varying(500) NOT NULL, "startingPriceClpSnapshot" integer, "message" character varying(1000) NOT NULL, "needNow" boolean NOT NULL DEFAULT false, "requestedDate" character varying(10), "requestedTime" character varying(5), "referencePhoto" character varying(2048), "status" character varying(20) NOT NULL DEFAULT 'requested', "quotedPriceClp" integer, "businessMessage" character varying(1000), "idempotencyKey" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_quote_request_quoted_price" CHECK ("quotedPriceClp" IS NULL OR "quotedPriceClp" >= 100), CONSTRAINT "PK_quote_request" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quote_request_user_idempotency" ON "quote_request" ("userId", "idempotencyKey")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quote_request_business_created" ON "quote_request" ("businessId", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_request" ADD CONSTRAINT "FK_quote_request_business" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_request" ADD CONSTRAINT "FK_quote_request_catalog" FOREIGN KEY ("catalogItemId") REFERENCES "catalog_item"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_request" ADD CONSTRAINT "FK_quote_request_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quote_request" DROP CONSTRAINT "FK_quote_request_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_request" DROP CONSTRAINT "FK_quote_request_catalog"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_request" DROP CONSTRAINT "FK_quote_request_business"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quote_request_business_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_quote_request_user_idempotency"`,
    );
    await queryRunner.query(`DROP TABLE "quote_request"`);
  }
}
