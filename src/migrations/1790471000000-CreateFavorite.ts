import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFavorite1790471000000 implements MigrationInterface {
  name = 'CreateFavorite1790471000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "favorite" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "businessId" integer NOT NULL, "kind" character varying(20) NOT NULL DEFAULT 'business', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_favorite_kind" CHECK ("kind" IN ('business','service')), CONSTRAINT "PK_favorite" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_favorite_user_business" ON "favorite" ("userId", "businessId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite" ADD CONSTRAINT "FK_favorite_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite" ADD CONSTRAINT "FK_favorite_business" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "favorite"`);
  }
}
