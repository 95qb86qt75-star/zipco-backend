import { validate } from 'class-validator';
import { CreateBusinessDto } from './create-business.dto';
import { UpdateBusinessDto } from './update-business.dto';

describe('Business DTOs', () => {
  const validFields = {
    name: 'Bicicletas Maria',
    description: 'Taller y venta',
    type: 'store',
    address: 'Coronel',
    latitude: -37.0,
    longitude: -73.0,
    phone: '56911111111',
    email: 'contacto@example.com',
    photo: 'https://example.com/photo.jpg',
    keywords: 'bicicletas taller',
    category: 'Bicicletas',
    categoryId: 5,
    schedule: '{}',
    instagram: '@bicicletas',
    facebook: 'bicicletas',
    products: '[]',
    isOpen: false,
    showOnlyDistance: false,
  };

  it('CreateBusinessDto accepts legitimate fields', async () => {
    const dto = Object.assign(new CreateBusinessDto(), validFields);
    expect(await validate(dto)).toEqual([]);
  });

  it('UpdateBusinessDto accepts legitimate partial fields', async () => {
    const dto = Object.assign(new UpdateBusinessDto(), {
      categoryId: 5,
      isOpen: false,
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('CreateBusinessDto requires categoryId', async () => {
    const dto = Object.assign(new CreateBusinessDto(), { name: 'Negocio' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'categoryId')).toBe(true);
  });

  it('rejects invalid categoryId and boolean values', async () => {
    const dto = Object.assign(new UpdateBusinessDto(), {
      categoryId: 0,
      isOpen: 'false',
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['categoryId', 'isOpen']),
    );
  });
});
