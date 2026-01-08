// frontend/src/pages/Jobs/JobsList.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";

import { jobsApi, type Job, type JobStatus } from "../../api/jobsApi";

const STATUS_OPTIONS: { label: string; value: JobStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Created", value: "created" },
  { label: "Scheduled", value: "scheduled" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Canceled", value: "canceled" },
];

function fmtMoney(n: any) {
  const v = Number(n || 0);
  return v.toFixed(2);
}

function statusPill(status: JobStatus) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border";
  switch (status) {
    case "created":
      return `${base} border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200`;
    case "scheduled":
      return `${base} border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-200`;
    case "in_progress":
      return `${base} border-amber-200 text-amber-700 dark:border-amber-700 dark:text-amber-200`;
    case "completed":
      return `${base} border-green-200 text-green-700 dark:border-green-700 dark:text-green-200`;
    case "canceled":
      return `${base} border-red-200 text-red-700 dark:border-red-700 dark:text-red-200`;
    default:
      return `${base} border-gray-200 text-gray-700`;
  }
}

export default function JobsList() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const [items, setItems] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState<number>(Number(sp.get("page") || 1));
  const [limit] = useState<number>(20);

  const [search, setSearch] = useState<string>(sp.get("search") || "");
  const [status, setStatus] = useState<JobStatus | "">((sp.get("status") as any) || "");

  const [totalPages, setTotalPages] = useState<number>(1);

  // keep URL in sync (nice for refresh/back button)
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    navigate({ pathname: "/jobs", search: params.toString() }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status]);

  const query = useMemo(
    () => ({ page, limit, search: search.trim() || undefined, status: status || undefined }),
    [page, limit, search, status]
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await jobsApi.list(query);
        if (!mounted) return;
        setItems(data.items || []);
        setTotalPages(data.totalPages || 1);
      } catch (e: any) {
        // Billing middleware usually returns 402 => redirect to /billing
        const httpStatus = e?.response?.status;
        if (httpStatus === 402) {
          navigate("/billing");
          return;
        }
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load jobs");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [query, navigate]);

  return (
    <div>
      <PageBreadCrumb pageTitle="Jobs" />

      <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark md:p-6">
        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-end">
            <div className="w-full md:max-w-md">
              <Input
                label="Search"
                placeholder="Job number, title, customer…"
                value={search}
                onChange={(e: any) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>

            <div className="w-full md:max-w-xs">
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                Status
              </label>
              <select
                className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as any);
                }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPage(1);
                setSearch("");
                setStatus("");
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 overflow-x-auto">
          {error ? (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="min-w-[150px] px-4 py-4 font-medium text-black dark:text-white">
                  Job
                </th>
                <th className="min-w-[220px] px-4 py-4 font-medium text-black dark:text-white">
                  Customer
                </th>
                <th className="min-w-[160px] px-4 py-4 font-medium text-black dark:text-white">
                  Status
                </th>
                <th className="min-w-[160px] px-4 py-4 font-medium text-black dark:text-white">
                  Total (inc GST)
                </th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-600 dark:text-gray-300" colSpan={5}>
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-600 dark:text-gray-300" colSpan={5}>
                    No jobs found.
                  </td>
                </tr>
              ) : (
                items.map((j) => (
                  <tr key={j._id} className="border-b border-stroke dark:border-strokedark">
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-black dark:text-white">{j.jobNumber}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {j.title || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-black dark:text-white">
                          {j.customerSnapshot?.name || "—"}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {j.customerSnapshot?.email || ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={statusPill((j.status || "created") as JobStatus)}>
                        {String(j.status || "created").replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-medium text-black dark:text-white">
                        {fmtMoney(j.totalIncTax)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        to={`/jobs/${j._id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}