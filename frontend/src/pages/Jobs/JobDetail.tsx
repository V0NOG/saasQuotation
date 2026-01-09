// frontend/src/pages/Jobs/JobDetail.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";

import { useAuth } from "../../context/AuthContext";
import { userApi } from "../../api/userApi";
import type { AuthUser } from "../../context/AuthContext";


import { jobsApi, type Job, type JobStatus } from "../../api/jobsApi";

const STATUS_OPTIONS: { label: string; value: JobStatus }[] = [
  { label: "Created", value: "created" },
  { label: "Scheduled", value: "scheduled" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Canceled", value: "canceled" },
];

function toLocalInputValue(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  // datetime-local expects "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function fmtMoney(n: any) {
  return Number(n || 0).toFixed(2);
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const bread = useMemo(() => [{ label: "Jobs", path: "/jobs" }, { label: "Job Detail" }], []);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const [orgUsers, setOrgUsers] = useState<AuthUser[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>(""); // "" = unassigned

  // editable fields
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<JobStatus>("created");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [statusNote, setStatusNote] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUsers() {
      if (!isAdmin) return;
      try {
        const users = await userApi.list({ role: "staff" });
        if (!mounted) return;
        setOrgUsers(users || []);
      } catch {
        // ignore - not critical to block job page
      }
    }

    loadUsers();
    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      setError("");
      try {
        const j = await jobsApi.get(id);
        if (!mounted) return;
        setJob(j);
        setTitle(j.title || "");
        setStatus(j.status || "created");
        setScheduledStart(toLocalInputValue(j.scheduledStart || null));
        setScheduledEnd(toLocalInputValue(j.scheduledEnd || null));
        setNotes(j.notes || "");
        setAssignedTo((j as any).assignedTo || "");
      } catch (e: any) {
        const httpStatus = e?.response?.status;
        if (httpStatus === 402) {
          navigate("/billing");
          return;
        }
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load job");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id, navigate]);

  async function save() {
    if (!id) return;
    setSaving(true);
    setError("");
    try {
      const updated = await jobsApi.update(id, {
        title,
        status,
        scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : null,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
        notes,
        statusNote: statusNote.trim() || undefined,
        assignedTo: assignedTo || null,
      });
      setJob(updated);
      setStatusNote("");
    } catch (e: any) {
      const httpStatus = e?.response?.status;
      if (httpStatus === 402) {
        navigate("/billing");
        return;
      }
      setError(e?.response?.data?.message || "Failed to save job");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Job Detail" breadCrumb={bread as any} />

      <div className="mt-4 rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark md:p-6">
        {error ? (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">Loading…</div>
        ) : !job ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">Job not found.</div>
        ) : (
          <>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-lg font-semibold text-black dark:text-white">{job.jobNumber}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Customer: {job.customerSnapshot?.name || "—"}{" "}
                  {job.customerSnapshot?.email ? `• ${job.customerSnapshot.email}` : ""}
                </div>
              </div>

              <div className="flex gap-2">
                <Link to="/jobs">
                  <Button variant="outline">Back</Button>
                </Link>
                {job.quoteId ? (
                  <Link to={`/quotes/${job.quoteId}`}>
                    <Button variant="outline">Open Quote</Button>
                  </Link>
                ) : null}
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-sm border border-stroke p-4 dark:border-strokedark">
                <div className="mb-3 text-sm font-semibold text-black dark:text-white">Details</div>

                <div className="grid grid-cols-1 gap-3">
                  <Input label="Title" value={title} onChange={(e: any) => setTitle(e.target.value)} />

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Status</label>
                    <select
                      className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2">
                      <Input
                        label="Status note (optional)"
                        value={statusNote}
                        onChange={(e: any) => setStatusNote(e.target.value)}
                        placeholder="E.g. Scheduled with customer, waiting on parts..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Scheduled start</label>
                      <input
                        type="datetime-local"
                        value={scheduledStart}
                        onChange={(e) => setScheduledStart(e.target.value)}
                        className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Scheduled end</label>
                      <input
                        type="datetime-local"
                        value={scheduledEnd}
                        onChange={(e) => setScheduledEnd(e.target.value)}
                        className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Notes</label>
                    <textarea
                      className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
                      rows={4}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Job notes..."
                    />
                  </div>
                </div>
                {isAdmin ? (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                      Assigned staff
                    </label>
                    <select
                      className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {orgUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.firstName || u.lastName)
                            ? `${u.firstName || ""} ${u.lastName || ""}`.trim()
                            : u.email}{" "}
                          ({u.email})
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      Only admin/owner can assign jobs.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="rounded-sm border border-stroke p-4 dark:border-strokedark">
                <div className="mb-3 text-sm font-semibold text-black dark:text-white">Totals</div>
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex justify-between">
                    <span>Subtotal (ex GST)</span>
                    <span>{fmtMoney(job.subtotalExTax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST</span>
                    <span>{fmtMoney(job.taxTotal)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-black dark:text-white">
                    <span>Total (inc GST)</span>
                    <span>{fmtMoney(job.totalIncTax)}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-2 text-sm font-semibold text-black dark:text-white">Status history</div>
                  {Array.isArray(job.statusHistory) && job.statusHistory.length > 0 ? (
                    <div className="space-y-2">
                      {job.statusHistory
                        .slice()
                        .reverse()
                        .map((h, idx) => (
                          <div
                            key={idx}
                            className="rounded border border-stroke bg-white p-3 text-sm dark:border-strokedark dark:bg-boxdark"
                          >
                            <div className="text-black dark:text-white">
                              <span className="font-medium">{h.from || "—"}</span> →{" "}
                              <span className="font-medium">{h.to}</span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">
                              {h.at ? new Date(h.at).toLocaleString() : ""}
                              {h.meta?.note ? ` • ${h.meta.note}` : ""}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 dark:text-gray-300">No history yet.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}