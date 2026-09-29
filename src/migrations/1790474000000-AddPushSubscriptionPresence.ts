import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushSubscriptionPresence1790474000000 implements MigrationInterface {
  name = 'AddPushSubscriptionPresence1790474000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "push_subscription" ADD "isForeground" boolean NOT NULL DEFAULT false',
    );
    await queryRunner.query(
      'ALTER TABLE "push_subscription" ADD "lastSeenAt" TIMESTAMP WITH TIME ZONE',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "push_subscription" DROP COLUMN "lastSeenAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "push_subscription" DROP COLUMN "isForeground"',
    );
  }
}
