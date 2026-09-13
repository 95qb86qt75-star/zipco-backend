import { assertSafeDevDatabaseUrl } from '../dev/dev-environment';

export type MigrationDatabaseConfig = {
  url: string;
  ssl: false | { rejectUnauthorized: false };
};

const LOCAL_MIGRATION_DATABASE_NAME = 'zipco_migration_test';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function assertSafeLocalMigrationDatabase(
  url: string,
  sslValue: string,
  env: NodeJS.ProcessEnv,
): void {
  const safetyMode = env.MIGRATION_SAFETY_MODE?.trim().toLowerCase();

  if (!safetyMode) {
    return;
  }

  if (safetyMode !== 'local-test') {
    throw new Error('MIGRATION_SAFETY_MODE no es valido.');
  }

  if (env.NODE_ENV !== 'test') {
    throw new Error(
      'Las migraciones locales de prueba requieren NODE_ENV=test.',
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('MIGRATION_DATABASE_URL no es una URL valida.');
  }

  const databaseName = parsedUrl.pathname.replace(/^\//, '');
  const sslMode = parsedUrl.searchParams.get('sslmode')?.toLowerCase();
  const hasSafeSslMode = !sslMode || sslMode === 'disable';

  if (
    !['postgres:', 'postgresql:'].includes(parsedUrl.protocol) ||
    !LOOPBACK_HOSTS.has(parsedUrl.hostname) ||
    databaseName !== LOCAL_MIGRATION_DATABASE_NAME ||
    sslValue !== 'false' ||
    !hasSafeSslMode
  ) {
    throw new Error(
      'Las migraciones locales de prueba solo pueden usar PostgreSQL local, la base zipco_migration_test y SSL desactivado.',
    );
  }
}

export function getMigrationDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): MigrationDatabaseConfig {
  const url = env.MIGRATION_DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'MIGRATION_DATABASE_URL es obligatorio para ejecutar comandos de migración.',
    );
  }

  const sslValue = env.MIGRATION_DATABASE_SSL?.trim().toLowerCase();
  if (sslValue !== 'true' && sslValue !== 'false') {
    throw new Error(
      'MIGRATION_DATABASE_SSL debe estar definido como "true" o "false".',
    );
  }

  assertSafeDevDatabaseUrl(url, env);
  assertSafeLocalMigrationDatabase(url, sslValue, env);

  return {
    url,
    ssl: sslValue === 'true' ? { rejectUnauthorized: false } : false,
  };
}
