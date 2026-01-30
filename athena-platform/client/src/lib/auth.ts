import tokenStore from './tokenStore';

export function getAccessToken(): string | null {
  return tokenStore.getInMemoryAccessToken();
}

// We no longer expose refresh token to JS (HttpOnly cookie only)
export function getRefreshToken(): string | null {
  return null;
}

export function setAccessTokenCookie(_token: string | null) {
  // kept as a no-op to avoid surprises; access token is in-memory only now
}

export function setTokens(accessToken: string, _refreshToken: string | null) {
  // Store access token in memory only. Refresh tokens remain HttpOnly cookies.
  tokenStore.setInMemoryAccessToken(accessToken);
}

export function clearTokens() {
  tokenStore.clearInMemoryAccessToken();
}

export function bootstrapAuthFromStorage() {
  // Migration shim: no client-side persisted token.
  // Real bootstrap should call `/auth/refresh` to obtain a fresh access token.
  return null;
}
