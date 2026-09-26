import { BadRequestException } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

describe('LocationsController', () => {
  const locationsService = {
    suggest: jest.fn().mockResolvedValue([]),
  };
  const controller = new LocationsController(
    locationsService as unknown as LocationsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it.each([undefined, '', 'Co', 'x'.repeat(121)])(
    'rejects invalid query %j',
    async (query) => {
      expect(() => controller.suggest(query)).toThrow(BadRequestException);
      expect(locationsService.suggest).not.toHaveBeenCalled();
    },
  );

  it('trims and forwards a valid query', async () => {
    await controller.suggest('  Coro  ');
    expect(locationsService.suggest).toHaveBeenCalledWith('Coro');
  });
});
