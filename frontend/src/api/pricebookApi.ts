// frontend/src/api/pricebookApi.ts
import { http } from "./http";

export type PriceItemType = "service" | "material";

export type PriceItem = {
  _id: string;
  type: PriceItemType;
  name: string;
  description?: string;
  unitPrice: number;
  taxRate?: number | null;
  defaultMinutes?: number | null;
  unit?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PricebookListResponse = {
  items: PriceItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const pricebookApi = {
  async list(params: { type: PriceItemType; search?: string; page?: number; limit?: number }) {
    const { data } = await http.get<PricebookListResponse>("/pricebook/items", { params });
    return data;
  },

  async create(payload: Omit<Partial<PriceItem>, "_id"> & { type: PriceItemType; name: string; unitPrice: number }) {
    const { data } = await http.post<{ item: PriceItem }>("/pricebook/items", payload);
    return data.item;
  },

  async update(id: string, payload: Partial<PriceItem>) {
    const { data } = await http.patch<{ item: PriceItem }>(`/pricebook/items/${id}`, payload);
    return data.item;
  },

  async remove(id: string) {
    const { data } = await http.delete<{ ok: boolean }>(`/pricebook/items/${id}`);
    return data.ok;
  },
};