// frontend/src/api/customersApi.ts
import { http } from "./http";

export type Customer = {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  address?: {
    line1?: string;
    line2?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type CustomersListResponse = {
  items: Customer[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const customersApi = {
  async list(params: { search?: string; page?: number; limit?: number }) {
    const { data } = await http.get<CustomersListResponse>("/customers", { params });
    return data;
  },

  async create(payload: Partial<Customer> & { name: string }) {
    const { data } = await http.post<{ customer: Customer }>("/customers", payload);
    return data.customer;
  },

  async update(id: string, payload: Partial<Customer>) {
    const { data } = await http.patch<{ customer: Customer }>(`/customers/${id}`, payload);
    return data.customer;
  },

  async remove(id: string) {
    const { data } = await http.delete<{ ok: boolean }>(`/customers/${id}`);
    return data.ok;
  },
};