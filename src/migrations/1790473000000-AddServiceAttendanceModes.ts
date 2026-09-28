import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceAttendanceModes1790473000000 implements MigrationInterface {
  name = 'AddServiceAttendanceModes1790473000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "business" ADD "offersOnSite" boolean',
    );
    await queryRunner.query(
      'ALTER TABLE "business" ADD "offersAtCustomerLocation" boolean',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "business" DROP COLUMN "offersAtCustomerLocation"',
    );
    await queryRunner.query(
      'ALTER TABLE "business" DROP COLUMN "offersOnSite"',
    );
  }
}
