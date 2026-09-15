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
// An access token is a bearer token: whoever holds it is the member until it
// expires, and nothing but the session check stands in the way. An hour keeps
// a token copied from a log or a proxy short-lived; the clients refresh on
// the first 401 without the member noticing.
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// The only algorithm this server signs with, and therefore the only one it
// verifies: a token that names another is refused before its signature is
// looked at.
const JWT_ALGORITHM = 'HS256' as const;

/**
 * Which door a token opens. An access token and a refresh token are signed
 * with the same key, so without this claim each would verify as the other;
 * the session lookup catches that today, and the claim makes it a refusal on
 * its own. Refresh tokens issued before the claim existed carry none and are
 * still accepted as refresh tokens until they expire.
 */
export type TokenType = 'access' | 'refresh';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  persona: string;
}

interface DecodedTokenPayload extends TokenPayload {
  typ?: TokenType;
  exp?: number;
  iat?: number;
  jti?: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRES_IN as any,
    jwtid: randomUUID(),
  };
  return jwt.sign({ ...payload, typ: 'access' as TokenType }, getJwtSecretOrThrow(), options);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_REFRESH_EXPIRES_IN as any,
    jwtid: randomUUID(),
  };
  return jwt.sign({ ...payload, typ: 'refresh' as TokenType }, getJwtSecretOrThrow(), options);
};

/**
 * Verifies the signature and expiry and, when told which kind of token is
 * expected, that the token is of that kind. The error is the same
 * JsonWebTokenError the signature check raises, so callers treat a token of
 * the wrong kind exactly as they treat a forged one.
 */
export const verifyToken = (token: string, expected?: TokenType): TokenPayload => {
  const decoded = jwt.verify(token, getJwtSecretOrThrow(), { algorithms: [JWT_ALGORITHM] }) as DecodedTokenPayload;

  if (expected && !isTokenOfType(decoded, expected)) {
    throw new jwt.JsonWebTokenError(`token is not a ${expected} token`);
  }

  return decoded;
};

/** A refresh token from before the claim existed carries no type and still counts. */
export function isTokenOfType(decoded: { typ?: TokenType }, expected: TokenType): boolean {
  if (expected === 'access') return decoded.typ === 'access';
  return decoded.typ === 'refresh' || decoded.typ === undefined;
}

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
