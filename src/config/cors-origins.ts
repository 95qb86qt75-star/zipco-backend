const PRODUCTION_FRONTEND_ORIGIN = 'https://zipco-app.vercel.app';
const DEVELOPMENT_FRONTEND_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
];

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const MAX_CONFIGURED_ORIGINS = 10;

function validateOrigin(value: string, isDevelopment: boolean): string {
  if (value.includes('*')) {
    throw new Error('FRONTEND_ORIGINS no permite comodines.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Origen CORS invalido: ${value}`);
  }

  if (
    parsed.origin !== value ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`Origen CORS invalido: ${value}`);
  }

  const isHttps = parsed.protocol === 'https:';
  const isLocalDevelopmentOrigin =
    isDevelopment &&
    parsed.protocol === 'http:' &&
    LOOPBACK_HOSTS.has(parsed.hostname);

  if (!isHttps && !isLocalDevelopmentOrigin) {
    throw new Error(
      'FRONTEND_ORIGINS exige HTTPS fuera de desarrollo local.',
    );
  }

  return parsed.origin;
}

export function getCorsOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const isDevelopment = env.NODE_ENV === 'development';
  const configuredValue = env.FRONTEND_ORIGINS;

  if (configuredValue === undefined) {
    return isDevelopment
      ? [...DEVELOPMENT_FRONTEND_ORIGINS]
      : [PRODUCTION_FRONTEND_ORIGIN];
  }

  const configured = configuredValue.trim();
  if (!configured) {
    throw new Error('FRONTEND_ORIGINS no puede estar vacio.');
  }

  const candidates = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!candidates.length || candidates.length > MAX_CONFIGURED_ORIGINS) {
    throw new Error(
      `FRONTEND_ORIGINS debe contener entre 1 y ${MAX_CONFIGURED_ORIGINS} origenes.`,
    );
  }

  return [
    ...new Set(
      candidates.map((origin) => validateOrigin(origin, isDevelopment)),
    ),
  ];
}
