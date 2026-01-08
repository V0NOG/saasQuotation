// frontend/src/api/http.ts
import axios from "axios";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:5050";

export const http = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true, // important for refresh cookie
});

const TOKEN_KEY = "userToken"; // ✅ single source of truth for the app

let accessToken: string | null = localStorage.getItem(TOKEN_KEY);

export function setAccessToken(token: string | null) {
  accessToken = token;

  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);

  window.dispatchEvent(new Event("auth:changed"));
}

export function getAccessToken() {
  return accessToken;
}

export function isLoggedIn() {
  return !!accessToken;
}

/**
 * ✅ Billing event helper (UI can listen and redirect to /billing)
 */
function notifyBillingRequired(payload?: any) {
  try {
    window.dispatchEvent(
      new CustomEvent("billing:required", {
        detail: payload ?? {},
      })
    );
  } catch {
    // ignore
  }
}

function isBillingEndpoint(url?: string) {
  if (!url) return false;
  // axios config.url is usually like "/quotes" etc
  return (
    url.startsWith("/billing") ||
    url.startsWith("/org/billing") ||
    url.startsWith("/org/me") // optional: keep org/me accessible even when gated
  );
}

function isAuthRefreshEndpoint(url?: string) {
  return Boolean(url && url.startsWith("/auth/refresh"));
}

function isPublicEndpoint(url?: string) {
  if (!url) return false;
  return url.startsWith("/public");
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
    const original = err?.config as any;
    const status = err?.response?.status as number | undefined;
    const url = (original?.url as string | undefined) || "";

    /**
     * ✅ Global billing gate handling
     * - Don’t fire for billing/org billing endpoints (prevents loops on Billing page)
     * - Don’t fire for public endpoints
     */
    if (status === 402 && !isBillingEndpoint(url) && !isPublicEndpoint(url)) {
      notifyBillingRequired({
        status: 402,
        url,
        message: err?.response?.data?.message,
        data: err?.response?.data,
      });
      return Promise.reject(err);
    }

    /**
     * ✅ Refresh flow
     * - Only for 401s
     * - Do not attempt if the request itself was /auth/refresh
     * - Do not retry endlessly
     */
    if (status === 401 && !original?._retry && !isAuthRefreshEndpoint(url)) {
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
        return Promise.reject(err);
      }
    }

    return Promise.reject(err);
  }
);