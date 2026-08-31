export type MigrationDatabaseConfig = {
  url: string;
  ssl: false | { rejectUnauthorized: false };
};

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

  return {
    url,
    ssl: sslValue === 'true' ? { rejectUnauthorized: false } : false,
  };
}
