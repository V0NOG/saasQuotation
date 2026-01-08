// frontend/src/components/ecommerce/billing/PaymentMethod.tsx
import Button from "../../ui/button/Button";
import { authApi, type BillingSummary } from "../../../api/authApi";
import { useEffect, useMemo, useState } from "react";

function cap(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function PaymentMethod() {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<BillingSummary | null>(null);

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
        const s = await authApi.billingSummary();
        if (mounted) setSummary(s);
      } catch {
        if (mounted) setSummary(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const pm = summary?.defaultPaymentMethod || null;

  const subtitle = useMemo(() => {
    if (loading) return "Loading payment method…";
    if (!pm) return "No card found yet. Add one via Stripe portal.";
    const exp =
      pm.expMonth && pm.expYear ? `Exp ${String(pm.expMonth).padStart(2, "0")}/${String(pm.expYear).slice(-2)}` : "";
    return `${cap(pm.brand)} •••• ${pm.last4}${exp ? ` • ${exp}` : ""}`;
  }, [loading, pm]);

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col justify-between gap-4 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Payment method</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Stripe stores and manages your payment methods securely.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="h-11" onClick={openPortal} disabled={busy}>
            {busy ? "Opening…" : "Manage in Stripe"}
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-200 p-6 dark:border-gray-800">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800 dark:text-white/90">Default card</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                We don’t store card details — this is read from Stripe.
              </div>
            </div>

            <Button variant="primary" className="h-11" onClick={openPortal} disabled={busy}>
              {busy ? "Redirecting…" : pm ? "Update card" : "Add payment method"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}