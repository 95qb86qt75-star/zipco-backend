import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderCancellationReason1788232355197 implements MigrationInterface {
  name = 'AddOrderCancellationReason1788232355197';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "order"
            ADD "cancellationReason" character varying
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "order" DROP COLUMN "cancellationReason"
        `);
  }
}
