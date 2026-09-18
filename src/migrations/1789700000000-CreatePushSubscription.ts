import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePushSubscription1789700000000
  implements MigrationInterface
{
  name = 'CreatePushSubscription1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "push_subscription" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "endpoint" character varying(2048) NOT NULL,
        "p256dh" character varying(512) NOT NULL,
        "auth" character varying(512) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_push_subscription_endpoint" UNIQUE ("endpoint"),
        CONSTRAINT "PK_push_subscription" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_push_subscription_userId" ON "push_subscription" ("userId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "push_subscription"
      ADD CONSTRAINT "FK_push_subscription_user"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "push_subscription"
      DROP CONSTRAINT "FK_push_subscription_user"
    `);
    await queryRunner.query(`DROP INDEX "IDX_push_subscription_userId"`);
    await queryRunner.query(`DROP TABLE "push_subscription"`);
  }
}
