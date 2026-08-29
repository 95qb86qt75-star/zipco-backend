export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return databaseUrl;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DATABASE_URL es obligatorio en producción. El backend no puede arrancar sin esta variable de entorno.',
    );
  }

  throw new Error(
    'DATABASE_URL no está definido. Verifica tu archivo .env local.',
  );
}
