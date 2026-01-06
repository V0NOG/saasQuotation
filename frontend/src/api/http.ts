// src/api/http.ts
import axios from "axios";

export const http = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
  withCredentials: true, // important for refresh cookie
});

const TOKEN_KEY = "userToken"; // ✅ unify (OAuthCallBack uses this)

let accessToken: string | null = localStorage.getItem(TOKEN_KEY);

export function setAccessToken(token: string | null) {
  accessToken = token;

  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);

  // ✅ let UI know auth changed
  window.dispatchEvent(new Event("auth:changed"));
}

export function getAccessToken() {
  return accessToken;
}

export function isLoggedIn() {
  return !!accessToken;
}

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

http.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;

    if (err.response?.status === 401 && !original?._retry) {
      original._retry = true;

      try {
        if (!refreshing) {
          refreshing = http
            .post("/auth/refresh")
            .then((res) => (res.data.accessToken as string) || null)
            .catch(() => null)
            .finally(() => {
              refreshing = null;
            });
        }

        const newToken = await refreshing;

        if (!newToken) {
          setAccessToken(null);
          return Promise.reject(err);
        }

        setAccessToken(newToken);
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return http(original);
      } catch {
        setAccessToken(null);
      }
    }

    return Promise.reject(err);
  }
);