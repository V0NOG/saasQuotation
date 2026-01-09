// frontend/src/api/jobsApi.ts
import { http } from "./http";

export type JobStatus = "created" | "scheduled" | "in_progress" | "completed" | "canceled";

export type Job = {
  _id: string;
  jobNumber: string;
  status: JobStatus;
  title?: string;

  assignedTo?: string | null;

  customerSnapshot?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };

  scheduledStart?: string | null;
  scheduledEnd?: string | null;

  subtotalExTax?: number;
  taxTotal?: number;
  totalIncTax?: number;

  quoteId?: string;

  notes?: string;

  statusHistory?: Array<{
    from?: string;
    to: string;
    at: string;
    actorType: "user" | "system";
    actorUserId?: string | null;
    meta?: { note?: string };
  }>;

  createdAt?: string;
  updatedAt?: string;
};

export type JobListResponse = {
  items: Job[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const jobsApi = {
  async list(params: { page?: number; limit?: number; search?: string; status?: JobStatus | ""; assignedTo?: string }) {
    const { data } = await http.get<JobListResponse>("/jobs", { params });
    return data;
  },

  async get(id: string) {
    const { data } = await http.get<{ job: Job }>(`/jobs/${id}`);
    return data.job;
  },

  async update(
    id: string,
    patch: Partial<Pick<Job, "status" | "scheduledStart" | "scheduledEnd" | "title" | "notes" | "assignedTo">> & {
      statusNote?: string;
    }
  ) {
    const { data } = await http.patch<{ job: Job }>(`/jobs/${id}`, patch);
    return data.job;
  },
};