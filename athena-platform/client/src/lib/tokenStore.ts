let accessToken: string | null = null;

export function getInMemoryAccessToken(): string | null {
  return accessToken;
}

export function setInMemoryAccessToken(token: string | null) {
  accessToken = token;
}

export function clearInMemoryAccessToken() {
  accessToken = null;
}

export default {
  getInMemoryAccessToken,
  setInMemoryAccessToken,
  clearInMemoryAccessToken,
};
