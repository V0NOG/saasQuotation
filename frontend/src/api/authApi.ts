// frontend/src/api/authApi.ts
import { http, setAccessToken } from "./http";
import type { AuthUser, AuthOrg } from "../context/AuthContext";

type AuthResponse = {
  accessToken: string;
  user: AuthUser;
  org?: AuthOrg | null;
};

export type BillingSummary = {
  customer: { id: string; name: string; email: string } | null;
  defaultPaymentMethod:
    | { id: string; brand: string; last4: string; expMonth: number | null; expYear: number | null }
    | null;
};

export type BillingInvoice = {
  id: string;
  number: string;
  status: string;
  created: string | null;
  currency: string;
  amountDue: number;
  amountPaid: number;
  total: number;
  hostedInvoiceUrl: string;
  invoicePdf: string;
};

export const authApi = {
  async login(email: string, password: string) {
    const { data } = await http.post<AuthResponse>("/auth/login", { email, password });
    setAccessToken(data.accessToken);
    return data;
  },

  async register(payload: { orgName: string; firstName: string; lastName: string; email: string; password: string }) {
    const { data } = await http.post<AuthResponse>("/auth/register", payload);
    setAccessToken(data.accessToken);
    return data;
  },

  async billingMe() {
    const { data } = await http.get<{ billing: any; org: any }>("/org/billing");
    return data;
  },

  async billingSummary() {
    const { data } = await http.get<BillingSummary>("/billing/summary");
    return data;
  },

  async billingInvoices(limit = 10) {
    const { data } = await http.get<{ items: BillingInvoice[] }>(`/billing/invoices?limit=${limit}`);
    return data.items || [];
  },

  async createCheckoutSession(input: { plan: "starter" | "pro"; trial?: boolean }) {
    const { data } = await http.post<{ url: string }>("/billing/checkout", input);
    return data;
  },

  async createBillingPortal() {
    const { data } = await http.post<{ url: string }>("/billing/portal");
    return data;
  },

  async logout() {
    try {
      await http.post("/auth/logout");
    } catch {}
    setAccessToken(null);
    return true;
  },

  async me() {
    const { data } = await http.get<{ user: AuthUser }>("/auth/me");
    return data.user;
  },

  async orgMe() {
    const { data } = await http.get<{ org: AuthOrg }>("/org/me");
    return data.org;
  },
};