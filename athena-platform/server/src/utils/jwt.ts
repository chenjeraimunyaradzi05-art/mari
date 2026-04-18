import jwt, { SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';

export function getJwtSecretOrThrow(): string {
  const secret = process.env.JWT_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }

  return 'dev-only-secret-not-for-production';
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  persona: string;
}

interface DecodedTokenPayload extends TokenPayload {
  exp?: number;
  iat?: number;
  jti?: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as any,
    jwtid: randomUUID(),
  };
  return jwt.sign(payload, getJwtSecretOrThrow(), options);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: JWT_REFRESH_EXPIRES_IN as any,
    jwtid: randomUUID(),
  };
  return jwt.sign(payload, getJwtSecretOrThrow(), options);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, getJwtSecretOrThrow()) as TokenPayload;
};

export const decodeToken = (token: string): DecodedTokenPayload | null => {
  try {
    return jwt.decode(token) as DecodedTokenPayload;
  } catch {
    return null;
  }
};

export const getTokenExpiresInSeconds = (token: string): number | null => {
  const decoded = decodeToken(token);
  if (!decoded?.exp) {
    return null;
  }

  return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
};
