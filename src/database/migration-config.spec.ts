import { getMigrationDatabaseConfig } from './migration-config';

describe('getMigrationDatabaseConfig', () => {
  it('returns an explicit local configuration', () => {
    expect(
      getMigrationDatabaseConfig({
        MIGRATION_DATABASE_URL:
          'postgresql://example.invalid/zipco_migration_test',
        MIGRATION_DATABASE_SSL: 'false',
      }),
    ).toEqual({
      url: 'postgresql://example.invalid/zipco_migration_test',
      ssl: false,
    });
  });

  it('enables SSL explicitly', () => {
    expect(
      getMigrationDatabaseConfig({
        MIGRATION_DATABASE_URL: 'postgresql://example.invalid/zipco',
        MIGRATION_DATABASE_SSL: 'true',
      }).ssl,
    ).toEqual({ rejectUnauthorized: false });
  });

  it('fails without a migration URL', () => {
    expect(() =>
      getMigrationDatabaseConfig({
        MIGRATION_DATABASE_SSL: 'false',
      }),
    ).toThrow('MIGRATION_DATABASE_URL es obligatorio');
  });

  it('rejects a remote migration database while dev auth is enabled', () => {
    expect(() =>
      getMigrationDatabaseConfig({
        NODE_ENV: 'development',
        ENABLE_DEV_AUTH: 'true',
        MIGRATION_DATABASE_URL:
          'postgresql://user:pass@remote.example/zipco_development',
        MIGRATION_DATABASE_SSL: 'false',
      }),
    ).toThrow('Dev auth solo puede usar PostgreSQL local');
  });

  it('accepts the isolated local migration test database', () => {
    expect(
      getMigrationDatabaseConfig({
        NODE_ENV: 'test',
        MIGRATION_SAFETY_MODE: 'local-test',
        MIGRATION_DATABASE_URL:
          'postgresql://zipco_dev:local@127.0.0.1:5432/zipco_migration_test?sslmode=disable',
        MIGRATION_DATABASE_SSL: 'false',
      }),
    ).toEqual({
      url: 'postgresql://zipco_dev:local@127.0.0.1:5432/zipco_migration_test?sslmode=disable',
      ssl: false,
    });
  });

  it('rejects a remote host in local migration test mode', () => {
    expect(() =>
      getMigrationDatabaseConfig({
        NODE_ENV: 'test',
        MIGRATION_SAFETY_MODE: 'local-test',
        MIGRATION_DATABASE_URL:
          'postgresql://user:pass@remote.example/zipco_migration_test',
        MIGRATION_DATABASE_SSL: 'false',
      }),
    ).toThrow('solo pueden usar PostgreSQL local');
  });

  it('rejects the wrong database in local migration test mode', () => {
    expect(() =>
      getMigrationDatabaseConfig({
        NODE_ENV: 'test',
        MIGRATION_SAFETY_MODE: 'local-test',
        MIGRATION_DATABASE_URL:
          'postgresql://zipco_dev:local@127.0.0.1:5432/zipco_development',
        MIGRATION_DATABASE_SSL: 'false',
      }),
    ).toThrow('la base zipco_migration_test');
  });

  it('rejects SSL in local migration test mode', () => {
    expect(() =>
      getMigrationDatabaseConfig({
        NODE_ENV: 'test',
        MIGRATION_SAFETY_MODE: 'local-test',
        MIGRATION_DATABASE_URL:
          'postgresql://zipco_dev:local@localhost:5432/zipco_migration_test',
        MIGRATION_DATABASE_SSL: 'true',
      }),
    ).toThrow('SSL desactivado');
  });

  it('rejects local migration test mode outside NODE_ENV=test', () => {
    expect(() =>
      getMigrationDatabaseConfig({
        NODE_ENV: 'development',
        MIGRATION_SAFETY_MODE: 'local-test',
        MIGRATION_DATABASE_URL:
          'postgresql://zipco_dev:local@127.0.0.1:5432/zipco_migration_test',
        MIGRATION_DATABASE_SSL: 'false',
      }),
    ).toThrow('requieren NODE_ENV=test');
  });

  it('rejects an unknown migration safety mode', () => {
    expect(() =>
      getMigrationDatabaseConfig({
        NODE_ENV: 'test',
        MIGRATION_SAFETY_MODE: 'local-tset',
        MIGRATION_DATABASE_URL:
          'postgresql://zipco_dev:local@127.0.0.1:5432/zipco_migration_test',
        MIGRATION_DATABASE_SSL: 'false',
      }),
    ).toThrow('MIGRATION_SAFETY_MODE no es valido');
  });

  it('fails without an explicit SSL choice', () => {
    expect(() =>
      getMigrationDatabaseConfig({
        MIGRATION_DATABASE_URL: 'postgresql://example.invalid/zipco',
      }),
    ).toThrow('MIGRATION_DATABASE_SSL debe estar definido');
  });
});
