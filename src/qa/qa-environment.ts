import { DataSource } from 'typeorm';

export function isQaAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.NODE_ENV === 'production' &&
    env.APP_ENVIRONMENT === 'qa' &&
    env.ENABLE_QA_AUTH === 'true'
  );
}

export function assertQaAuthConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isQaAuthEnabled(env)) return;
  if (!env.QA_AUTH_KEY?.trim() || !env.QA_DATABASE_INSTANCE_ID?.trim()) {
    throw new Error(
      'QA_AUTH_KEY y QA_DATABASE_INSTANCE_ID son obligatorios para QA auth.',
    );
  }
}

export async function assertQaDatabaseMarker(
  dataSource: DataSource,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (!isQaAuthEnabled(env)) return;
  const rows: Array<{ environment_kind: string; instance_id: string }> =
    await dataSource.query(
      'SELECT environment_kind, instance_id FROM app_environment WHERE id = 1',
    );
  const marker = rows[0];
  if (
    marker?.environment_kind !== 'qa' ||
    marker.instance_id !== env.QA_DATABASE_INSTANCE_ID
  ) {
    throw new Error('La base no tiene el marcador QA esperado.');
  }
}

export function assertQaSetupConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV !== 'production' || env.APP_ENVIRONMENT !== 'qa') {
    throw new Error(
      'El setup QA requiere NODE_ENV=production y APP_ENVIRONMENT=qa.',
    );
  }
  if (!env.QA_AUTH_KEY?.trim() || !env.QA_DATABASE_INSTANCE_ID?.trim()) {
    throw new Error(
      'QA_AUTH_KEY y QA_DATABASE_INSTANCE_ID son obligatorios para el setup QA.',
    );
  }
}
