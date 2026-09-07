import { DataSource } from 'typeorm';
import {
  assertDevAuthConfiguration,
  assertDevDatabaseMarker,
  assertSafeDevDatabaseUrl,
  getServerListenHost,
  isDevAuthEnabled,
} from './dev-environment';

const enabled = {
  NODE_ENV: 'development',
  ENABLE_DEV_AUTH: 'true',
  DEV_AUTH_KEY: 'key',
  DEV_DATABASE_INSTANCE_ID: 'instance',
} as NodeJS.ProcessEnv;

describe('development environment safety', () => {
  it('binds every development server to loopback even when dev auth is disabled or absent', () => {
    expect(
      getServerListenHost({
        NODE_ENV: 'development',
        ENABLE_DEV_AUTH: 'false',
      }),
    ).toBe('127.0.0.1');
    expect(getServerListenHost({ NODE_ENV: 'development' })).toBe(
      '127.0.0.1',
    );
    expect(getServerListenHost({ NODE_ENV: 'production' })).toBeUndefined();
  });

  it('requires both explicit development gates', () => {
    expect(isDevAuthEnabled(enabled)).toBe(true);
    expect(isDevAuthEnabled({ ...enabled, NODE_ENV: 'production' })).toBe(
      false,
    );
    expect(isDevAuthEnabled({ ...enabled, ENABLE_DEV_AUTH: 'false' })).toBe(
      false,
    );
  });

  it('accepts only the dedicated loopback database', () => {
    expect(() =>
      assertSafeDevDatabaseUrl(
        'postgresql://dev:pass@127.0.0.1:5432/zipco_development?sslmode=disable',
        enabled,
      ),
    ).not.toThrow();
    for (const url of [
      'postgresql://dev:pass@remote.example/zipco_development',
      'postgresql://dev:pass@127.0.0.1/production',
      'postgresql://dev:pass@127.0.0.1/zipco_development?sslmode=require',
    ])
      expect(() => assertSafeDevDatabaseUrl(url, enabled)).toThrow();
  });

  it('requires local keys when enabled', () => {
    expect(() => assertDevAuthConfiguration(enabled)).not.toThrow();
    expect(() =>
      assertDevAuthConfiguration({ ...enabled, DEV_AUTH_KEY: '' }),
    ).toThrow();
  });

  it('accepts only the matching database marker', async () => {
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValue([
          { environment_kind: 'development', instance_id: 'instance' },
        ]),
    } as unknown as DataSource;
    await expect(
      assertDevDatabaseMarker(dataSource, enabled),
    ).resolves.toBeUndefined();
    (dataSource.query as jest.Mock).mockResolvedValue([
      { environment_kind: 'production', instance_id: 'instance' },
    ]);
    await expect(
      assertDevDatabaseMarker(dataSource, enabled),
    ).rejects.toThrow();
  });
});
