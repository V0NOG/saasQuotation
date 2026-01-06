// frontend/src/api/authStorage.ts
export const AUTH_KEYS = {
  accessToken: "accessToken",
  refreshToken: "refreshToken", // only if you use it
  user: "authUser",            // optional
} as const;

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_KEYS.accessToken);
}

export function setAccessToken(token: string) {
  localStorage.setItem(AUTH_KEYS.accessToken, token);
  window.dispatchEvent(new Event("auth:changed"));
}

export function clearAuthStorage() {
  localStorage.removeItem(AUTH_KEYS.accessToken);
  localStorage.removeItem(AUTH_KEYS.refreshToken);
  localStorage.removeItem(AUTH_KEYS.user);
  window.dispatchEvent(new Event("auth:changed"));
}