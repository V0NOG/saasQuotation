// frontend/src/components/ecommerce/billing/PaymentMethod.tsx
import Button from "../../ui/button/Button";
import { authApi } from "../../../api/authApi";
import { useState } from "react";

export default function PaymentMethod() {
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
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col justify-between gap-5 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Payment Methods</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Payment methods are managed securely in Stripe.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11" onClick={openPortal} disabled={busy}>
            {busy ? "Opening…" : "Manage in Stripe"}
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-200 p-6 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
        We don’t store card details. Use Stripe’s customer portal to add/remove cards and update billing details.
      </div>
    </div>
  );
}