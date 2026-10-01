import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendRequestLifecycle1790476000000 implements MigrationInterface {
  name = 'ExtendRequestLifecycle1790476000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "order" ADD "cancellationReasonDetail" character varying');
    await queryRunner.query('ALTER TABLE "order" ADD "customerDeletedAt" TIMESTAMP WITH TIME ZONE');
    await queryRunner.query('ALTER TABLE "order" ADD "businessDeletedAt" TIMESTAMP WITH TIME ZONE');
    await queryRunner.query('ALTER TABLE "order" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()');
    await queryRunner.query('ALTER TABLE "order" ADD "alternativeDate" character varying(10)');
    await queryRunner.query('ALTER TABLE "order" ADD "alternativeTime" character varying(5)');
    await queryRunner.query('ALTER TABLE "order" ADD "alternativeItem" character varying(120)');
    await queryRunner.query('ALTER TABLE "order" ADD "alternativeQuantity" integer');
    await queryRunner.query('ALTER TABLE "order" ADD "alternativePriceClp" integer');
    await queryRunner.query('ALTER TABLE "order" ADD "alternativeMessage" character varying(1000)');
    await queryRunner.query('ALTER TABLE "quote_request" ADD "closureReason" character varying(50)');
    await queryRunner.query('ALTER TABLE "quote_request" ADD "closureReasonDetail" character varying(1000)');
    await queryRunner.query('ALTER TABLE "quote_request" ADD "customerDeletedAt" TIMESTAMP WITH TIME ZONE');
    await queryRunner.query('ALTER TABLE "quote_request" ADD "businessDeletedAt" TIMESTAMP WITH TIME ZONE');
    await queryRunner.query('ALTER TABLE "quote_request" ADD "alternativeDate" character varying(10)');
    await queryRunner.query('ALTER TABLE "quote_request" ADD "alternativeTime" character varying(5)');
    await queryRunner.query('ALTER TABLE "quote_request" ADD "alternativeItem" character varying(120)');
    await queryRunner.query('ALTER TABLE "quote_request" ADD "alternativeQuantity" integer');
    await queryRunner.query('ALTER TABLE "quote_request" ADD "alternativePriceClp" integer');
    await queryRunner.query('ALTER TABLE "quote_request" ADD "alternativeMessage" character varying(1000)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "quote_request" DROP COLUMN "alternativeMessage"');
    await queryRunner.query('ALTER TABLE "quote_request" DROP COLUMN "alternativePriceClp"');
    await queryRunner.query('ALTER TABLE "quote_request" DROP COLUMN "alternativeQuantity"');
    await queryRunner.query('ALTER TABLE "quote_request" DROP COLUMN "alternativeItem"');
    await queryRunner.query('ALTER TABLE "quote_request" DROP COLUMN "alternativeTime"');
    await queryRunner.query('ALTER TABLE "quote_request" DROP COLUMN "alternativeDate"');
    await queryRunner.query('ALTER TABLE "quote_request" DROP COLUMN "businessDeletedAt"');
    await queryRunner.query('ALTER TABLE "quote_request" DROP COLUMN "customerDeletedAt"');
    await queryRunner.query('ALTER TABLE "quote_request" DROP COLUMN "closureReasonDetail"');
    await queryRunner.query('ALTER TABLE "quote_request" DROP COLUMN "closureReason"');
    await queryRunner.query('ALTER TABLE "order" DROP COLUMN "updatedAt"');
    await queryRunner.query('ALTER TABLE "order" DROP COLUMN "alternativeMessage"');
    await queryRunner.query('ALTER TABLE "order" DROP COLUMN "alternativePriceClp"');
    await queryRunner.query('ALTER TABLE "order" DROP COLUMN "alternativeQuantity"');
    await queryRunner.query('ALTER TABLE "order" DROP COLUMN "alternativeItem"');
    await queryRunner.query('ALTER TABLE "order" DROP COLUMN "alternativeTime"');
    await queryRunner.query('ALTER TABLE "order" DROP COLUMN "alternativeDate"');
    await queryRunner.query('ALTER TABLE "order" DROP COLUMN "businessDeletedAt"');
    await queryRunner.query('ALTER TABLE "order" DROP COLUMN "customerDeletedAt"');
    await queryRunner.query('ALTER TABLE "order" DROP COLUMN "cancellationReasonDetail"');
  }
}
