// frontend/src/pages/Quotes/QuotesList.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { quoteApi, type Quote, type QuoteStatus } from "../../api/quoteApi";

function StatusBadge({ status }: { status: QuoteStatus }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";

  if (status === "draft") return <span className={`${base} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200`}>Draft</span>;
  if (status === "sent") return <span className={`${base} bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200`}>Sent</span>;
  if (status === "accepted") return <span className={`${base} bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200`}>Accepted</span>;
  return <span className={`${base} bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200`}>Declined</span>;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export default function QuotesList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "">("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [items, setItems] = useState<Quote[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await quoteApi.list({ search, status, page, limit });
      setItems(res.items);
      setTotalPages(res.totalPages);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  async function onDelete(q: Quote) {
    const ok = window.confirm(`Delete ${q.quoteNumber}?`);
    if (!ok) return;
    await quoteApi.remove(q._id);
    await load();
  }

  async function onSend(q: Quote) {
    if (q.status !== "draft") return;
    setSendingId(q._id);
    try {
      await quoteApi.send(q._id);
      await load();
    } finally {
      setSendingId(null);
    }
  }

  async function onCopyLink(q: Quote) {
    if (!q.publicToken) return;
    const url = `${window.location.origin}/quote/view/${q.publicToken}`;
    const ok = await copyToClipboard(url);
    if (ok) alert("Public link copied!");
    else alert("Could not copy link.");
  }

  return (
    <div>
      <PageBreadCrumb title="Quotes" breadCrumb={[{ label: "Quotes" }]} />

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-3 md:max-w-2xl md:flex-row">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quote #, customer…" />

            <select
              className="h-[44px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
            </select>
          </div>

          <Link to="/quotes/new">
            <Button>Create Quote</Button>
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-gray-200 text-left dark:border-gray-800">
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Quote</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Customer</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Total (inc GST)</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-gray-600 dark:text-gray-300">Loading…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-gray-600 dark:text-gray-300">No quotes found.</td>
                </tr>
              ) : (
                items.map((q) => (
                  <tr key={q._id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      <Link to={`/quotes/${q._id}`} className="text-brand-600 hover:underline">
                        {q.quoteNumber}
                      </Link>
                      {q.title ? <div className="text-xs text-gray-500">{q.title}</div> : null}
                      {q.publicToken ? (
                        <div className="mt-1 text-xs text-gray-500">
                          Public link available
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {q.customerSnapshot?.name || "—"}
                      {q.customerSnapshot?.email ? <div className="text-xs text-gray-500">{q.customerSnapshot.email}</div> : null}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      <StatusBadge status={q.status} />
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {(q.totalIncTax ?? 0).toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <Link
                          to={`/quotes/${q._id}`}
                          className="rounded-lg px-3 py-1 text-sm text-brand-600 hover:bg-brand-50 dark:hover:bg-gray-800"
                        >
                          {q.status === "accepted" ? "View" : "Edit"}
                        </Link>

                        {q.status === "draft" ? (
                          <button
                            onClick={() => onSend(q)}
                            disabled={sendingId === q._id}
                            className="rounded-lg px-3 py-1 text-sm text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60"
                          >
                            {sendingId === q._id ? "Sending..." : "Send"}
                          </button>
                        ) : null}

                        {q.publicToken ? (
                          <button
                            onClick={() => onCopyLink(q)}
                            className="rounded-lg px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            Copy link
                          </button>
                        ) : null}

                        <button
                          onClick={() => onDelete(q)}
                          className="rounded-lg px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-gray-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
              Prev
            </Button>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}