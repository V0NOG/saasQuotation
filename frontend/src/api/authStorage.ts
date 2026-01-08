// frontend/src/api/authStorage.ts
import { getAccessToken, setAccessToken } from "./http";

export const AUTH_KEYS = {
  accessToken: "userToken",
} as const;

export { getAccessToken, setAccessToken };

export function clearAuthStorage() {
  setAccessToken(null);
}