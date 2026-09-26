import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhoneChangeVerification1790400000000 implements MigrationInterface {
  name = 'AddPhoneChangeVerification1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "verification_code" ADD "purpose" character varying NOT NULL DEFAULT 'login'`,
    );
    await queryRunner.query(
      `ALTER TABLE "verification_code" ADD "userId" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "verification_code" DROP COLUMN "userId"`);
    await queryRunner.query(`ALTER TABLE "verification_code" DROP COLUMN "purpose"`);
  }
}
