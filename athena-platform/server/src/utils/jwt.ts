import jwt, { SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';

// Resolve JWT_SECRET lazily so env.ts fallback has time to run before first use.
// The getter is called on every sign/verify — cheap and avoids import-time crashes.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.error('[JWT] WARNING: JWT_SECRET is not set in production! Using insecure fallback.');
    }
    return 'dev-only-secret-not-for-production';
  }
  return secret;
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  persona: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as any,
    jwtid: randomUUID(),
  };
  return jwt.sign(payload, getJwtSecret(), options);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: JWT_REFRESH_EXPIRES_IN as any,
    jwtid: randomUUID(),
  };
  return jwt.sign(payload, getJwtSecret(), options);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
};

export const decodeToken = (token: string): TokenPayload | null => {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
};
