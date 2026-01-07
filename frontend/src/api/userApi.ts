// frontend/src/api/userApi.ts
import { http } from "./http";
import type { AuthUser } from "../context/AuthContext";

export const userApi = {
  async me() {
    const { data } = await http.get<{ user: AuthUser }>("/user/me");
    return data.user;
  },

  async updateMe(payload: Partial<AuthUser>) {
    const { data } = await http.patch<{ user: AuthUser }>("/user/me", payload);
    return data.user;
  },
};