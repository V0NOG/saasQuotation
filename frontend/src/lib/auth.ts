// src/lib/auth.ts
export const TOKEN_KEY = "userToken";

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return !!getAccessToken();
}

export function setAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("auth:changed"));
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("auth:changed"));
}