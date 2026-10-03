import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAlternativePhoto1790990000000 implements MigrationInterface {
  name = 'AddAlternativePhoto1790990000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD "alternativePhoto" character varying(2048)`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_request" ADD "alternativePhoto" character varying(2048)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quote_request" DROP COLUMN "alternativePhoto"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "alternativePhoto"`,
    );
  }
}
