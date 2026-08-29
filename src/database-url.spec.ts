import { getDatabaseUrl } from './database-url';

describe('getDatabaseUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns DATABASE_URL when it is defined', () => {
    process.env.DATABASE_URL =
      'postgresql://local-user:local-password@localhost:5432/zipco';

    expect(getDatabaseUrl()).toBe(process.env.DATABASE_URL);
  });

  it('throws a production-specific error when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'production';

    expect(() => getDatabaseUrl()).toThrow(
      'DATABASE_URL es obligatorio en producción. El backend no puede arrancar sin esta variable de entorno.',
    );
  });

  it('throws a local-development error when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'development';

    expect(() => getDatabaseUrl()).toThrow(
      'DATABASE_URL no está definido. Verifica tu archivo .env local.',
    );
  });
});
