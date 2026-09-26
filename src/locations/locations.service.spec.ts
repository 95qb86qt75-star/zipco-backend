import { ServiceUnavailableException } from '@nestjs/common';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns only normalized Chilean suggestions for partial searches', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { coordinates: [-73.1333, -37.0333] },
            properties: {
              osm_id: 101,
              name: 'Coronel',
              state: 'Región del Biobío',
              countrycode: 'CL',
            },
          },
          {
            geometry: { coordinates: [-68.1, -16.5] },
            properties: {
              osm_id: 102,
              name: 'Coro Coro',
              countrycode: 'BO',
            },
          },
        ],
      }),
    }) as jest.Mock;

    const result = await new LocationsService().suggest('Coro');

    expect(result).toEqual([
      expect.objectContaining({
        place_id: '101',
        display_name: 'Coronel, Región del Biobío, Chile',
        lat: '-37.0333',
        lon: '-73.1333',
        address: expect.objectContaining({ country_code: 'cl' }),
      }),
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('q=Coro'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('caches repeated normalized queries', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    }) as jest.Mock;
    const service = new LocationsService();

    await service.suggest(' Coron ');
    await service.suggest('coron');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns a controlled error when the provider is unavailable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    await expect(new LocationsService().suggest('Coro')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
