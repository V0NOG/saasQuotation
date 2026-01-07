// frontend/src/api/authApi.ts
import { http, setAccessToken } from "./http";
import type { AuthUser, AuthOrg } from "../context/AuthContext";

type AuthResponse = {
  accessToken: string;
  user: AuthUser;
  org?: AuthOrg | null;
};

export const authApi = {
  async login(email: string, password: string) {
    const { data } = await http.post<AuthResponse>("/auth/login", { email, password });
    setAccessToken(data.accessToken);
    return data;
  },

  async register(payload: {
    orgName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    const { data } = await http.post<AuthResponse>("/auth/register", payload);
    setAccessToken(data.accessToken);
    return data;
  },

  async logout() {
    try {
      await http.post("/auth/logout");
    } catch {
      // ignore
    }
    setAccessToken(null);
    return true;
  },

  async orgMe() {
    const { data } = await http.get<{ org: AuthOrg }>("/org/me");
    return data.org;
  },
};