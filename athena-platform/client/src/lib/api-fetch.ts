import { clearTokens, getAccessToken, setTokens } from './auth';
import { refreshSession } from './session-refresh';

const AUTH_REFRESH_PATH = '/api/auth/refresh';
const AUTH_PATHS_TO_SKIP_REFRESH = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/facebook',
  AUTH_REFRESH_PATH,
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

function isJsonBody(body: BodyInit | null | undefined): boolean {
  return Boolean(body) && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof URLSearchParams);
}

function requestPath(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.pathname;
  }

  return input.url;
}

function buildHeaders(init: RequestInit = {}, token?: string | null): Headers {
  const headers = new Headers(init.headers);

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (isJsonBody(init.body) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

// Shares the single in-flight refresh with the axios client and the session
// bootstrap. A refresh token is single-use on the server, and a second call
// racing the first is read as a replay that revokes every session.
async function refreshAccessToken(): Promise<string | null> {
  try {
    const { accessToken } = await refreshSession();
    if (typeof accessToken !== 'string' || !accessToken) {
      return null;
    }

    setTokens(accessToken, null);
    return accessToken;
  } catch {
    return null;
  }
}

function shouldRefresh(input: RequestInfo | URL): boolean {
  const path = requestPath(input);
  return !AUTH_PATHS_TO_SKIP_REFRESH.some((authPath) => path.includes(authPath));
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const response = await fetch(input, {
    ...init,
    credentials: init.credentials ?? 'include',
    headers: buildHeaders(init, token),
  });

  if (response.status !== 401 || !shouldRefresh(input)) {
    return response;
  }

  const refreshedToken = await refreshAccessToken();
  if (!refreshedToken) {
    clearTokens();
    return response;
  }

  return fetch(input, {
    ...init,
    credentials: init.credentials ?? 'include',
    headers: buildHeaders(init, refreshedToken),
  });
}
