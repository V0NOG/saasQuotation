// frontend/src/api/userApi.ts
import { http } from "./http";
import type { AuthUser } from "../context/AuthContext";

export type OrgUserListResponse = {
  items: AuthUser[];
};

export const userApi = {
  async me() {
    const { data } = await http.get<{ user: AuthUser }>("/users/me");
    return data.user;
  },

  async updateMe(payload: Partial<AuthUser>) {
    const { data } = await http.patch<{ user: AuthUser }>("/users/me", payload);
    return data.user;
  },

  async list(params?: { search?: string; role?: "owner" | "admin" | "staff" }) {
    const { data } = await http.get<OrgUserListResponse>("/users", { params });
    return data.items;
  },
};