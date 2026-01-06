import { http, setAccessToken } from "./http";

export async function login(email: string, password: string) {
  const res = await http.post("/auth/login", { email, password });
  setAccessToken(res.data.accessToken);
  return res.data;
}

export async function register(payload: {
  orgName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
}) {
  const res = await http.post("/auth/register", payload);
  setAccessToken(res.data.accessToken);
  return res.data;
}

export async function logout() {
  await http.post("/auth/logout");
  setAccessToken(null);
}