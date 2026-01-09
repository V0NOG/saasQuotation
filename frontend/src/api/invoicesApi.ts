// frontend/src/api/invoicesApi.ts
import { http } from "./http";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";
export type PricingMode = "exclusive" | "inclusive";

export type InvoiceLine = {
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

export type Invoice = {
  _id: string;
  invoiceNumber: string;
  status: InvoiceStatus;

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

  lines: InvoiceLine[];

  subtotalExTax: number;
  taxTotal: number;
  totalIncTax: number;

  issueDate?: string;
  dueDate?: string | null;

  sentAt?: string | null;
  paidAt?: string | null;

  quoteId?: string | null;
  jobId?: string | null;

  createdAt?: string;
};

export type InvoiceListResponse = {
  items: Invoice[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type EmailInvoicePayload = {
  to?: string;
  subject?: string;
  message?: string;
  attachPdf?: boolean;
};

export type EmailInvoiceResponse = {
  ok: boolean;
  duplicate?: boolean;
  messageId?: string;
};

function makeIdempotencyKey(prefix: string, id: string) {
  return `${prefix}-${id}-${Date.now()}`;
}

export const invoicesApi = {
  async list(params: { search?: string; status?: InvoiceStatus | ""; page?: number; limit?: number }) {
    const { data } = await http.get<InvoiceListResponse>("/invoices", { params });
    return data;
  },

  async create(payload: Partial<Invoice>) {
    const { data } = await http.post<{ invoice: Invoice }>("/invoices", payload);
    return data.invoice;
  },

  async getById(id: string) {
    const { data } = await http.get<{ invoice: Invoice }>(`/invoices/${id}`);
    return data.invoice;
  },

  async update(id: string, payload: Partial<Invoice>) {
    const { data } = await http.patch<{ invoice: Invoice }>(`/invoices/${id}`, payload);
    return data.invoice;
  },

  async send(id: string) {
    const { data } = await http.post<{ invoice: Invoice }>(`/invoices/${id}/send`);
    return data.invoice;
  },

  async markPaid(id: string, note?: string) {
    const { data } = await http.post<{ invoice: Invoice }>(`/invoices/${id}/mark-paid`, { note });
    return data.invoice;
  },

  async email(id: string, payload?: EmailInvoicePayload, opts?: { idempotencyKey?: string }) {
    const idempotencyKey = opts?.idempotencyKey || makeIdempotencyKey("invoice-email", id);
    const { data } = await http.post<EmailInvoiceResponse>(`/invoices/${id}/email`, payload || {}, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return data;
  },

  pdfUrl(id: string) {
    const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:5050";
    return `${base}/api/invoices/${id}/pdf`;
  },
};