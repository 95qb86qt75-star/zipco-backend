import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1788226473173 implements MigrationInterface {
  name = 'InitialSchema1788226473173';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);
    await queryRunner.query(`
            CREATE TABLE "verification_code" (
                "id" SERIAL NOT NULL,
                "phone" character varying NOT NULL,
                "codeHash" character varying NOT NULL,
                "expiresAt" TIMESTAMP NOT NULL,
                "consumed" boolean NOT NULL DEFAULT false,
                "attempts" integer NOT NULL DEFAULT '0',
                "verifiedAt" TIMESTAMP,
                "consumedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_d702c086da466e5d25974512d46" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "business" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "description" character varying,
                "type" character varying,
                "address" character varying,
                "latitude" numeric(10, 7) DEFAULT '0',
                "longitude" numeric(10, 7) DEFAULT '0',
                "phone" character varying,
                "email" character varying,
                "photo" character varying,
                "keywords" character varying,
                "category" character varying,
                "schedule" character varying,
                "instagram" character varying,
                "facebook" character varying,
                "products" character varying,
                "isOpen" boolean NOT NULL DEFAULT true,
                "showOnlyDistance" boolean NOT NULL DEFAULT false,
                "status" character varying NOT NULL DEFAULT 'pending',
                "categoryId" integer,
                "userId" integer NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_0bd850da8dafab992e2e9b058e5" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "category" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "icon" character varying,
                CONSTRAINT "PK_9c4e4a89e3674fc9f382d733f03" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "order" (
                "id" SERIAL NOT NULL,
                "businessId" integer NOT NULL,
                "userId" integer NOT NULL,
                "products" text NOT NULL,
                "note" character varying,
                "needNow" boolean NOT NULL DEFAULT false,
                "deliveryDate" character varying,
                "deliveryTime" character varying,
                "total" numeric(12, 2) NOT NULL DEFAULT '0',
                "status" character varying NOT NULL DEFAULT 'pending',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "referencePhoto" character varying,
                "customerName" character varying,
                "customerPhone" character varying,
                CONSTRAINT "PK_1031171c13130102495201e3e20" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "user" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "email" character varying NOT NULL,
                "password" character varying NOT NULL,
                "phone" character varying,
                "location" character varying,
                "photo" character varying,
                "businessMode" boolean NOT NULL DEFAULT false,
                "role" character varying NOT NULL DEFAULT 'user',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"),
                CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE "user"
        `);
    await queryRunner.query(`
            DROP TABLE "order"
        `);
    await queryRunner.query(`
            DROP TABLE "category"
        `);
    await queryRunner.query(`
            DROP TABLE "business"
        `);
    await queryRunner.query(`
            DROP TABLE "verification_code"
        `);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "unaccent"`);
  }
}
