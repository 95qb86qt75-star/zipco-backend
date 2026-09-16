import { getCorsOrigins } from './cors-origins';

describe('getCorsOrigins', () => {
  it('uses only the production frontend by default outside development', () => {
    expect(getCorsOrigins({ NODE_ENV: 'production' })).toEqual([
      'https://zipco-app.vercel.app',
    ]);
  });

  it('uses only loopback frontends by default in local development', () => {
    expect(getCorsOrigins({ NODE_ENV: 'development' })).toEqual([
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ]);
  });

  it('uses an exact environment-specific allowlist and removes duplicates', () => {
    expect(
      getCorsOrigins({
        NODE_ENV: 'production',
        FRONTEND_ORIGINS:
          'https://zipco-qa.vercel.app, https://zipco-qa.vercel.app',
      }),
    ).toEqual(['https://zipco-qa.vercel.app']);
  });

  it('fails closed when FRONTEND_ORIGINS is explicitly empty', () => {
    expect(() =>
      getCorsOrigins({
        NODE_ENV: 'production',
        FRONTEND_ORIGINS: '   ',
      }),
    ).toThrow('no puede estar vacio');
  });

  it.each([
    'https://*.vercel.app',
    'http://zipco-qa.vercel.app',
    'https://zipco-qa.vercel.app/path',
    'https://zipco-qa.vercel.app?preview=true',
    'not-a-url',
  ])('rejects an unsafe configured origin: %s', (origin) => {
    expect(() =>
      getCorsOrigins({
        NODE_ENV: 'production',
        FRONTEND_ORIGINS: origin,
      }),
    ).toThrow();
  });

  it('allows HTTP loopback only during local development', () => {
    expect(
      getCorsOrigins({
        NODE_ENV: 'development',
        FRONTEND_ORIGINS: 'http://localhost:4173',
      }),
    ).toEqual(['http://localhost:4173']);

    expect(() =>
      getCorsOrigins({
        NODE_ENV: 'production',
        FRONTEND_ORIGINS: 'http://localhost:4173',
      }),
    ).toThrow('HTTPS');
  });

  it('rejects an excessive allowlist', () => {
    const origins = Array.from(
      { length: 11 },
      (_, index) => `https://preview-${index}.vercel.app`,
    ).join(',');

    expect(() =>
      getCorsOrigins({
        NODE_ENV: 'production',
        FRONTEND_ORIGINS: origins,
      }),
    ).toThrow('entre 1 y 10');
  });
});
