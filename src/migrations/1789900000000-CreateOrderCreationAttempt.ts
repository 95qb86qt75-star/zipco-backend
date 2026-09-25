import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderCreationAttempt1789900000000 implements MigrationInterface {
  name = 'CreateOrderCreationAttempt1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "order_creation_attempt" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "idempotencyKey" character varying(64) NOT NULL,
        "requestHash" character(64) NOT NULL,
        "orderId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_creation_attempt" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_order_creation_attempt_user_key" UNIQUE ("userId", "idempotencyKey"),
        CONSTRAINT "UQ_order_creation_attempt_order" UNIQUE ("orderId"),
        CONSTRAINT "FK_order_creation_attempt_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "order_creation_attempt"');
  }
}
