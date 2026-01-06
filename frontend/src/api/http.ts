import axios from "axios";

export const http = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
  withCredentials: true, // important for refresh cookie
});

let accessToken: string | null = localStorage.getItem("accessToken");

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem("accessToken", token);
  else localStorage.removeItem("accessToken");
}

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

http.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;

    // if access expired, try refresh once
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const res = await http.post("/auth/refresh");
        const newToken = res.data.accessToken as string;
        setAccessToken(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return http(original);
      } catch {
        setAccessToken(null);
      }
    }

    return Promise.reject(err);
  }
);