import { DataSource } from 'typeorm';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
export const DEV_DATABASE_NAME = 'zipco_development';

export function isDevAuthEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === 'development' && env.ENABLE_DEV_AUTH === 'true';
}

export function getServerListenHost(
  env: NodeJS.ProcessEnv = process.env,
): '127.0.0.1' | undefined {
  return env.NODE_ENV === 'development' ? '127.0.0.1' : undefined;
}

export function assertSafeDevDatabaseUrl(
  databaseUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isDevAuthEnabled(env)) return;

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('Dev auth requiere una DATABASE_URL local válida.');
  }

  const databaseName = parsed.pathname.replace(/^\//, '');
  const sslMode = parsed.searchParams.get('sslmode');
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !LOOPBACK_HOSTS.has(parsed.hostname) ||
    databaseName !== DEV_DATABASE_NAME ||
    (sslMode !== null && sslMode !== 'disable')
  ) {
    throw new Error(
      `Dev auth solo puede usar PostgreSQL local y la base ${DEV_DATABASE_NAME}.`,
    );
  }
}

export function assertDevAuthConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isDevAuthEnabled(env)) return;
  if (!env.DEV_AUTH_KEY?.trim() || !env.DEV_DATABASE_INSTANCE_ID?.trim()) {
    throw new Error(
      'DEV_AUTH_KEY y DEV_DATABASE_INSTANCE_ID son obligatorios para dev auth.',
    );
  }
}

export async function assertDevDatabaseMarker(
  dataSource: DataSource,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (!isDevAuthEnabled(env)) return;
  const rows: Array<{ environment_kind: string; instance_id: string }> =
    await dataSource.query(
      'SELECT environment_kind, instance_id FROM app_environment WHERE id = 1',
    );
  const marker = rows[0];
  if (
    marker?.environment_kind !== 'development' ||
    marker.instance_id !== env.DEV_DATABASE_INSTANCE_ID
  ) {
    throw new Error(
      'La base local no tiene el marcador de desarrollo esperado.',
    );
  }
}
