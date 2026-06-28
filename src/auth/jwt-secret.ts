import 'dotenv/config';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is required. Set it in your environment before starting the app.');
  }

  return secret;
}
