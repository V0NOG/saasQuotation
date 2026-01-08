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
  return `${prefix}-${id}-${Date.now()}`;
}

export type QuoteApiError = Error & {
  code?: number;
  data?: any;
  isPaymentRequired?: boolean;
};

function toQuoteApiError(e: any, fallbackMessage: string): QuoteApiError {
  const status = e?.response?.status;
  const message = e?.response?.data?.message || e?.message || fallbackMessage;

  const err = new Error(message) as QuoteApiError;
  err.code = typeof status === "number" ? status : undefined;
  err.data = e?.response?.data;
  err.isPaymentRequired = status === 402;
  return err;
}

async function wrap<T>(fn: () => Promise<T>, fallbackMessage: string): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    throw toQuoteApiError(e, fallbackMessage);
  }
}

// ✅ NEW: public action payload
export type PublicActionPayload = {
  name?: string;
  email?: string;
  note?: string;
};

export const quoteApi = {
  isPaymentRequiredError(e: any): boolean {
    return Boolean(e?.isPaymentRequired || e?.code === 402);
  },

  async list(params: { search?: string; status?: QuoteStatus | ""; page?: number; limit?: number }) {
    return wrap(async () => {
      const { data } = await http.get<QuoteListResponse>("/quotes", { params });
      return data;
    }, "Could not load quotes.");
  },

  async create(payload: Partial<Quote>) {
    return wrap(async () => {
      const { data } = await http.post<{ quote: Quote }>("/quotes", payload);
      return data.quote;
    }, "Could not create quote.");
  },

  async getById(id: string) {
    return wrap(async () => {
      const { data } = await http.get<{ quote: Quote }>(`/quotes/${id}`);
      return data.quote;
    }, "Could not load quote.");
  },

  async update(id: string, payload: Partial<Quote>) {
    return wrap(async () => {
      const { data } = await http.patch<{ quote: Quote }>(`/quotes/${id}`, payload);
      return data.quote;
    }, "Could not update quote.");
  },

  async remove(id: string) {
    return wrap(async () => {
      const { data } = await http.delete<{ ok: boolean }>(`/quotes/${id}`);
      return data.ok;
    }, "Could not delete quote.");
  },

  async email(id: string, payload?: EmailQuotePayload, opts?: { idempotencyKey?: string }) {
    const idempotencyKey = opts?.idempotencyKey || makeIdempotencyKey("quote-email", id);

    return wrap(async () => {
      const { data } = await http.post<EmailQuoteResponse>(`/quotes/${id}/email`, payload || {}, {
        headers: { "Idempotency-Key": idempotencyKey },
      });
      return data;
    }, "Could not email quote.");
  },

  async send(id: string) {
    return wrap(async () => {
      const { data } = await http.post<{ quote: Quote }>(`/quotes/${id}/send`);
      return data.quote;
    }, "Could not send quote.");
  },

  async getPublic(token: string) {
    return wrap(async () => {
      const { data } = await http.get<PublicQuoteResponse>(`/public/quotes/${token}`);
      return data.quote;
    }, "Could not load public quote.");
  },

  // ✅ UPDATED: accept/decline can send identity payload
  async acceptPublic(token: string, payload?: PublicActionPayload) {
    return wrap(async () => {
      const { data } = await http.post<{ quote: Quote }>(`/public/quotes/${token}/accept`, payload || {});
      return data.quote;
    }, "Could not accept quote.");
  },

  async declinePublic(token: string, payload?: PublicActionPayload) {
    return wrap(async () => {
      const { data } = await http.post<{ quote: Quote }>(`/public/quotes/${token}/decline`, payload || {});
      return data.quote;
    }, "Could not decline quote.");
  },
};