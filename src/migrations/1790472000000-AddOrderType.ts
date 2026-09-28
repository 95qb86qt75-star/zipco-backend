import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderType1790472000000 implements MigrationInterface {
  name = 'AddOrderType1790472000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD "orderType" character varying(20) NOT NULL DEFAULT 'product'`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD CONSTRAINT "CHK_order_type" CHECK ("orderType" IN ('product','service'))`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "orderType"`);
  }
}
