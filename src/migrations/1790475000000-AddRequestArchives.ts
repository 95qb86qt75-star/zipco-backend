import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestArchives1790475000000 implements MigrationInterface {
  name = 'AddRequestArchives1790475000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "order" ADD "customerArchivedAt" TIMESTAMP WITH TIME ZONE');
    await queryRunner.query('ALTER TABLE "order" ADD "businessArchivedAt" TIMESTAMP WITH TIME ZONE');
    await queryRunner.query('ALTER TABLE "quote_request" ADD "customerArchivedAt" TIMESTAMP WITH TIME ZONE');
    await queryRunner.query('ALTER TABLE "quote_request" ADD "businessArchivedAt" TIMESTAMP WITH TIME ZONE');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "quote_request" DROP COLUMN "businessArchivedAt"');
    await queryRunner.query('ALTER TABLE "quote_request" DROP COLUMN "customerArchivedAt"');
    await queryRunner.query('ALTER TABLE "order" DROP COLUMN "businessArchivedAt"');
    await queryRunner.query('ALTER TABLE "order" DROP COLUMN "customerArchivedAt"');
  }
}
