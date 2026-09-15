import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequireCatalogDescriptionAndImage1789357400000 implements MigrationInterface {
  name = 'RequireCatalogDescriptionAndImage1789357400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "catalog_item"
      ADD CONSTRAINT "CHK_catalog_item_description_not_blank"
      CHECK (length(btrim("description")) > 0)
    `);
    await queryRunner.query(`
      ALTER TABLE "catalog_item"
      ADD CONSTRAINT "CHK_catalog_item_cloudinary_image"
      CHECK ("imageUrl" ~ '^https://res[.]cloudinary[.]com/[^/?#[:space:]]+/image/upload/[^[:space:]]+$')
    `);
    await queryRunner.query(`
      ALTER TABLE "catalog_item"
      ALTER COLUMN "description" SET NOT NULL,
      ALTER COLUMN "imageUrl" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "catalog_item"
      ALTER COLUMN "description" DROP NOT NULL,
      ALTER COLUMN "imageUrl" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "catalog_item"
      DROP CONSTRAINT "CHK_catalog_item_cloudinary_image"
    `);
    await queryRunner.query(`
      ALTER TABLE "catalog_item"
      DROP CONSTRAINT "CHK_catalog_item_description_not_blank"
    `);
  }
}
