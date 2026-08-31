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

  it('fails without an explicit SSL choice', () => {
    expect(() =>
      getMigrationDatabaseConfig({
        MIGRATION_DATABASE_URL: 'postgresql://example.invalid/zipco',
      }),
    ).toThrow('MIGRATION_DATABASE_SSL debe estar definido');
  });
});
