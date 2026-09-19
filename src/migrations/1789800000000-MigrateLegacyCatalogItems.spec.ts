import { QueryRunner } from 'typeorm';
import { MigrateLegacyCatalogItems1789800000000 } from './1789800000000-MigrateLegacyCatalogItems';

describe('MigrateLegacyCatalogItems1789800000000', () => {
  it('migrates valid legacy order and view items without clearing the backup field', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 2,
          name: 'Tortas Eve',
          products: JSON.stringify([
            {
              name: 'Torta',
              description: 'Torta de prueba',
              price: '1200',
              mode: 'order',
              imageUrl:
                'https://res.cloudinary.com/demo/image/upload/torta.png',
            },
            {
              name: 'Galeria',
              description: 'Fotos de trabajos',
              price: '3000',
              mode: 'view',
              imageUrl:
                'https://res.cloudinary.com/demo/image/upload/galeria.png',
            },
          ]),
        },
      ])
      .mockResolvedValue([]);
    const queryRunner = { query } as unknown as QueryRunner;

    await new MigrateLegacyCatalogItems1789800000000().up(queryRunner);

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[1][1]).toEqual([
      2,
      'Torta',
      'Torta de prueba',
      'fixed_price',
      1200,
      'https://res.cloudinary.com/demo/image/upload/torta.png',
      0,
    ]);
    expect(query.mock.calls[2][1]).toEqual([
      2,
      'Galeria',
      'Fotos de trabajos',
      'view',
      null,
      'https://res.cloudinary.com/demo/image/upload/galeria.png',
      1,
    ]);
    expect(query.mock.calls[0][0]).toContain("NOT LIKE 'ZIPCO TEST%'");
  });

  it('ignores malformed legacy data instead of failing the deployment', async () => {
    const query = jest.fn().mockResolvedValueOnce([
      { id: 3, name: 'Roto', products: '{invalid' },
      {
        id: 4,
        name: 'Incompleto',
        products: JSON.stringify([{ name: 'Sin imagen', mode: 'order' }]),
      },
    ]);

    await new MigrateLegacyCatalogItems1789800000000().up({
      query,
    } as unknown as QueryRunner);

    expect(query).toHaveBeenCalledTimes(1);
  });
});
