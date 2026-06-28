import { clearTokens, getAccessToken, setTokens } from './auth';

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

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(AUTH_REFRESH_PATH, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const accessToken = payload?.data?.accessToken;

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
