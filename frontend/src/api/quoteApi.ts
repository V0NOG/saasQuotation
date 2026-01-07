// frontend/src/api/quoteApi.ts
import { http } from "./http";

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined";
export type PricingMode = "exclusive" | "inclusive";

export type QuoteLine = {
  _id?: string;
  itemId?: string | null;
  type: "service" | "material";
  name: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPriceExTax: number;
  taxRate?: number | null;
  minutes?: number | null;

  lineSubtotalExTax?: number;
  lineTax?: number;
  lineTotalIncTax?: number;
};

export type Quote = {
  _id: string;
  quoteNumber: string;
  status: QuoteStatus;

  publicToken?: string | null;
  publicTokenExpiresAt?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  lockedAt?: string | null;

  title?: string;
  notes?: string;

  pricingMode: PricingMode;

  customerId?: string | null;
  customerSnapshot?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };

  lines: QuoteLine[];

  subtotalExTax: number;
  taxTotal: number;
  totalIncTax: number;

  createdAt?: string;
};

export type QuoteListResponse = {
  items: Quote[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PublicQuoteResponse = { quote: Quote };

export type EmailQuotePayload = {
  to?: string;
  message?: string;
  attachPdf?: boolean;
};

export type EmailQuoteResponse = {
  ok: boolean;
  duplicate?: boolean;
  messageId?: string;
};

function makeIdempotencyKey(prefix: string, id: string) {
  // good enough for UI (unique-ish per click)
  return `${prefix}-${id}-${Date.now()}`;
}

export const quoteApi = {
  async list(params: { search?: string; status?: QuoteStatus | ""; page?: number; limit?: number }) {
    const { data } = await http.get<QuoteListResponse>("/quotes", { params });
    return data;
  },

  async create(payload: Partial<Quote>) {
    const { data } = await http.post<{ quote: Quote }>("/quotes", payload);
    return data.quote;
  },

  async getById(id: string) {
    const { data } = await http.get<{ quote: Quote }>(`/quotes/${id}`);
    return data.quote;
  },

  async update(id: string, payload: Partial<Quote>) {
    const { data } = await http.patch<{ quote: Quote }>(`/quotes/${id}`, payload);
    return data.quote;
  },

  async remove(id: string) {
    const { data } = await http.delete<{ ok: boolean }>(`/quotes/${id}`);
    return data.ok;
  },

  async email(id: string, payload?: EmailQuotePayload, opts?: { idempotencyKey?: string }) {
    const idempotencyKey = opts?.idempotencyKey || makeIdempotencyKey("quote-email", id);

    const { data } = await http.post<EmailQuoteResponse>(
      `/quotes/${id}/email`,
      payload || {},
      { headers: { "Idempotency-Key": idempotencyKey } }
    );

    return data;
  },

  async send(id: string) {
    const { data } = await http.post<{ quote: Quote }>(`/quotes/${id}/send`);
    return data.quote;
  },

  async getPublic(token: string) {
    const { data } = await http.get<PublicQuoteResponse>(`/public/quotes/${token}`);
    return data.quote;
  },

  async acceptPublic(token: string) {
    const { data } = await http.post<{ quote: Quote }>(`/public/quotes/${token}/accept`);
    return data.quote;
  },

  async declinePublic(token: string) {
    const { data } = await http.post<{ quote: Quote }>(`/public/quotes/${token}/decline`);
    return data.quote;
  },
};