// frontend/src/api/authApi.ts
import { http, setAccessToken } from "./http";
import type { AuthUser } from "../context/AuthContext";

export type AuthOrg = {
  id: string;
  name: string;
  currency: string;
  taxRate: number;
  branding: {
    logoUrl: string;
    primaryColor: string;
    accentColor: string;
  };
  industry?: "plumber" | "electrician" | "both";
};

type AuthResponse = {
  accessToken: string;
  user: AuthUser;
  org?: AuthOrg | null;
};

export const authApi = {
  async login(email: string, password: string) {
    const { data } = await http.post<AuthResponse>("/auth/login", { email, password });
    setAccessToken(data.accessToken); // ✅ critical
    return data; // returns { accessToken, user, org }
  },

  async register(payload: {
    orgName: string; // ✅ required by your backend
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    const { data } = await http.post<AuthResponse>("/auth/register", payload);
    setAccessToken(data.accessToken); // ✅ critical
    return data;
  },

  async logout() {
    // clears refresh cookie (server-side) and clears access token (client-side)
    try {
      await http.post("/auth/logout");
    } catch {
      // ignore network errors; still clear local token
    }
    setAccessToken(null);
    return true;
  },

  // ✅ Your backend does NOT have /auth/me, but it DOES have /org/me
  async orgMe() {
    const { data } = await http.get<{ org: AuthOrg }>("/org/me");
    return data.org;
  },
};