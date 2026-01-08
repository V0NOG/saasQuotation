// frontend/src/components/ecommerce/billing/InvoiceTable.tsx
import Button from "../../ui/button/Button";
import { authApi, type BillingInvoice } from "../../../api/authApi";
import { useEffect, useMemo, useState } from "react";

function fmtMoney(minor: number, currency: string) {
  try {
    const major = (minor || 0) / 100;
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "AUD").toUpperCase() }).format(
      major
    );
  } catch {
    return `${((minor || 0) / 100).toFixed(2)} ${(currency || "").toUpperCase()}`;
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function badge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "paid") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200";
  if (s === "open") return "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200";
  if (s === "void") return "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-200";
  if (s === "uncollectible") return "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200";
  return "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-200";
}

export default function InvoiceTable() {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BillingInvoice[]>([]);

  async function openPortal() {
    try {
      setBusy(true);
      const { url } = await authApi.createBillingPortal();
      window.location.href = url;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const inv = await authApi.billingInvoices(10);
        if (mounted) setItems(inv);
      } catch {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col justify-between gap-4 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Invoices</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Recent invoices from Stripe.</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="h-11" onClick={openPortal} disabled={busy}>
            {busy ? "Opening…" : "Open Stripe Portal"}
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-200 p-6 dark:border-gray-800">
        {loading ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">Loading invoices…</div>
        ) : empty ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center dark:border-gray-800">
            <div className="text-sm font-semibold text-gray-800 dark:text-white/90">No invoices yet</div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Invoices appear after your first payment (or trial conversion).
            </p>
            <div className="mt-4 flex justify-center">
              <Button variant="outline" className="h-11" onClick={openPortal} disabled={busy}>
                View in Stripe
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-white/[0.02] dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {items.map((inv) => (
                  <tr key={inv.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 dark:text-white/90">
                        {inv.number || inv.id}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{inv.id}</div>
                    </td>
                    <td className="px-4 py-3">{fmtDate(inv.created)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badge(inv.status)}`}>
                        {inv.status || "unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{fmtMoney(inv.total, inv.currency)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {inv.invoicePdf ? (
                          <a
                            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                            href={inv.invoicePdf}
                            target="_blank"
                            rel="noreferrer"
                          >
                            PDF
                          </a>
                        ) : null}
                        {inv.hostedInvoiceUrl ? (
                          <a
                            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                            href={inv.hostedInvoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}