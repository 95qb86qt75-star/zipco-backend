import { MigrationInterface, QueryRunner } from 'typeorm';

type LegacyCatalogItem = {
  name?: unknown;
  description?: unknown;
  price?: unknown;
  mode?: unknown;
  imageUrl?: unknown;
};

type LegacyBusiness = {
  id: number;
  name: string;
  products: string;
};

export class MigrateLegacyCatalogItems1789800000000 implements MigrationInterface {
  name = 'MigrateLegacyCatalogItems1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const businesses = (await queryRunner.query(`
      SELECT business.id, business.name, business.products
      FROM business
      WHERE business.products IS NOT NULL
        AND btrim(business.products) <> ''
        AND upper(btrim(business.name)) NOT LIKE 'ZIPCO TEST%'
        AND NOT EXISTS (
          SELECT 1
          FROM catalog_item
          WHERE catalog_item."businessId" = business.id
        )
      ORDER BY business.id
    `)) as LegacyBusiness[];

    for (const business of businesses) {
      let legacyItems: unknown;

      try {
        legacyItems = JSON.parse(business.products);
      } catch {
        continue;
      }

      if (!Array.isArray(legacyItems)) continue;

      let displayOrder = 0;
      for (const rawItem of legacyItems) {
        if (!rawItem || typeof rawItem !== 'object') continue;

        const item = rawItem as LegacyCatalogItem;
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        const description =
          typeof item.description === 'string' ? item.description.trim() : '';
        const imageUrl =
          typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
        const mode = typeof item.mode === 'string' ? item.mode : '';
        const numericPrice = Number(item.price);
        const priceClp = Number.isInteger(numericPrice) ? numericPrice : null;
        const pricingMode =
          mode === 'order' ? 'fixed_price' : mode === 'view' ? 'view' : null;

        if (
          !name ||
          !description ||
          !pricingMode ||
          !/^https:\/\/res[.]cloudinary[.]com\/[^/?#\s]+\/image\/upload\/\S+$/.test(
            imageUrl,
          ) ||
          (pricingMode === 'fixed_price' &&
            (priceClp === null || priceClp < 100))
        ) {
          continue;
        }

        await queryRunner.query(
          `
            INSERT INTO catalog_item (
              "businessId",
              name,
              description,
              kind,
              "pricingMode",
              "priceClp",
              "startingPriceClp",
              "imageUrl",
              "isActive",
              "displayOrder"
            )
            VALUES ($1, $2, $3, 'product', $4, $5, NULL, $6, true, $7)
          `,
          [
            business.id,
            name,
            description,
            pricingMode,
            pricingMode === 'fixed_price' ? priceClp : null,
            imageUrl,
            displayOrder,
          ],
        );

        displayOrder += 1;
      }
    }
  }

  public async down(): Promise<void> {
    // La reversión no elimina catálogos para evitar borrar cambios posteriores
    // realizados por los dueños. El campo legacy permanece intacto como respaldo.
  }
}
