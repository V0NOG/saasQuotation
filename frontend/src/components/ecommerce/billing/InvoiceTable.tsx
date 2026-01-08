// frontend/src/components/ecommerce/billing/InvoiceTable.tsx
import Button from "../../ui/button/Button";
import { authApi } from "../../../api/authApi";
import { useState } from "react";

export default function InvoiceTable() {
  const [busy, setBusy] = useState(false);

  async function openPortal() {
    try {
      setBusy(true);
      const { url } = await authApi.createBillingPortal();
      window.location.href = url;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col justify-between gap-5 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Invoices</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Download invoices and receipts from Stripe.</p>
        </div>

        <Button variant="outline" className="h-11" onClick={openPortal} disabled={busy}>
          {busy ? "Opening…" : "Open Stripe Portal"}
        </Button>
      </div>

      <div className="border-t border-gray-200 p-6 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
        Invoice history will appear in Stripe immediately after payments. We’ll add an in-app invoice list later if you want.
      </div>
    </div>
  );
}