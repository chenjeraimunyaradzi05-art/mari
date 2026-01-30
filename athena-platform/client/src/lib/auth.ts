export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
}

export function setAccessTokenCookie(token: string | null) {
  if (typeof document === 'undefined') return;

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

  if (!token) {
    document.cookie = `accessToken=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    return;
  }

  const oneWeekSeconds = 60 * 60 * 24 * 7;
  document.cookie = `accessToken=${encodeURIComponent(token)}; Path=/; Max-Age=${oneWeekSeconds}; SameSite=Lax${secure}`;
}

export function setTokens(accessToken: string, _refreshToken: string | null) {
  if (typeof window === 'undefined') return;
  // We only persist access token client-side; refresh tokens are stored HttpOnly in cookies
  localStorage.setItem('accessToken', accessToken);
  setAccessTokenCookie(accessToken);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  setAccessTokenCookie(null);
}

export function bootstrapAuthFromStorage() {
  const token = getAccessToken();
  if (token) setAccessTokenCookie(token);
  return token;
}
