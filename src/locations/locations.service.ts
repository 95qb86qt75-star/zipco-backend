import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LocationSuggestion } from './location-suggestion';

type PhotonFeature = {
  geometry?: { coordinates?: unknown[] };
  properties?: Record<string, unknown>;
};

type CachedSuggestions = {
  expiresAt: number;
  suggestions: LocationSuggestion[];
};

const PHOTON_URL = 'https://photon.komoot.io/api/';
const CHILE_BOUNDING_BOX = '-75,-56,-66,-17';
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

@Injectable()
export class LocationsService {
  private readonly cache = new Map<string, CachedSuggestions>();

  async suggest(rawQuery: string): Promise<LocationSuggestion[]> {
    const query = rawQuery.trim();
    const cacheKey = query.toLocaleLowerCase('es-CL');
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.suggestions;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const params = new URLSearchParams({
        q: query,
        limit: '20',
        bbox: CHILE_BOUNDING_BOX,
      });
      const response = await fetch(`${PHOTON_URL}?${params.toString()}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ZIPCO/1.0 location-autocomplete' },
      });

      if (!response.ok) {
        throw new Error(`Photon returned ${response.status}`);
      }

      const payload = (await response.json()) as { features?: PhotonFeature[] };
      const suggestions = this.normalizeFeatures(payload.features ?? []);
      this.remember(cacheKey, suggestions);
      return suggestions;
    } catch {
      throw new ServiceUnavailableException(
        'No se pudieron obtener sugerencias de ubicación',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeFeatures(features: PhotonFeature[]): LocationSuggestion[] {
    const seen = new Set<string>();
    const suggestions: LocationSuggestion[] = [];

    for (const feature of features) {
      const properties = feature.properties ?? {};
      if (String(properties.countrycode ?? '').toUpperCase() !== 'CL') continue;

      const coordinates = feature.geometry?.coordinates ?? [];
      const longitude = Number(coordinates[0]);
      const latitude = Number(coordinates[1]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

      const name = String(properties.name ?? '').trim();
      const street = String(properties.street ?? '').trim();
      const houseNumber = String(properties.housenumber ?? '').trim();
      const city = String(
        properties.city ?? properties.district ?? properties.locality ?? '',
      ).trim();
      const county = String(properties.county ?? '').trim();
      const state = String(properties.state ?? '').trim();
      const postcode = String(properties.postcode ?? '').trim();
      const streetAddress = [street, houseNumber].filter(Boolean).join(' ');
      const primary = houseNumber ? streetAddress : name || streetAddress;
      if (!primary) continue;

      const labelParts = [
        primary,
        city,
        county,
        state,
        postcode,
        'Chile',
      ].filter(
        (part, index, parts) =>
          part &&
          parts.findIndex(
            (candidate) => candidate.toLowerCase() === part.toLowerCase(),
          ) === index,
      );
      const displayName = labelParts.join(', ');
      const dedupeKey = `${displayName.toLowerCase()}|${latitude}|${longitude}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      suggestions.push({
        place_id: String(properties.osm_id ?? dedupeKey),
        display_name: displayName,
        lat: String(latitude),
        lon: String(longitude),
        address: {
          ...(street ? { road: street } : {}),
          ...(houseNumber ? { house_number: houseNumber } : {}),
          ...(city ? { city } : {}),
          ...(county ? { county } : {}),
          ...(state ? { state } : {}),
          ...(postcode ? { postcode } : {}),
          country: 'Chile',
          country_code: 'cl',
        },
      });

      if (suggestions.length === 5) break;
    }

    return suggestions;
  }

  private remember(key: string, suggestions: LocationSuggestion[]) {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      suggestions,
    });
  }
}
