// frontend/src/components/ecommerce/billing/BillingPlan.tsx
import Button from "../../ui/button/Button";
import { authApi } from "../../../api/authApi";
import { useMemo, useState } from "react";
import type { BillingState } from "../../../pages/Ecommerce/Billing";

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString();
}

function daysLeft(d: string | null | undefined) {
  if (!d) return null;
  const end = new Date(d).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function BillingPlan({
  orgName,
  billing,
  onRefresh,
}: {
  orgName: string;
  billing: BillingState;
  onRefresh?: () => Promise<void> | void;
}) {
  const plan = (billing?.plan as any) || "free";
  const status = (billing?.status as any) || "free";
  const trialEndsAt = billing?.trialEndsAt ?? null;
  const currentPeriodEnd = billing?.currentPeriodEnd ?? null;

  const isActive = status === "active" || status === "trialing";
  const isFree = plan === "free" || status === "free";
  const trialDays = daysLeft(trialEndsAt);

  const [busy, setBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "pro">("starter");
  const [wantsTrial, setWantsTrial] = useState(true);

  const planLabel = useMemo(() => (typeof plan === "string" ? plan.toUpperCase() : "FREE"), [plan]);

  const statusLabel =
    status === "trialing"
      ? trialDays !== null
        ? `Trial (${trialDays} day${trialDays === 1 ? "" : "s"} left)`
        : "Trial"
      : status === "active"
      ? "Active"
      : status === "past_due"
      ? "Past due"
      : status === "canceled"
      ? "Canceled"
      : "Free";

  async function startCheckout() {
    try {
      setBusy(true);
      const { url } = await authApi.createCheckoutSession({
        plan: selectedPlan,
        // ✅ only allow trial for starter (UI + backend both enforce this)
        trial: wantsTrial && selectedPlan === "starter",
      });
      window.location.href = url;
    } finally {
      setBusy(false);
    }
  }

  async function manageSubscription() {
    try {
      setBusy(true);
      const { url } = await authApi.createBillingPortal();
      window.location.href = url;
    } finally {
      setBusy(false);
    }
  }

  async function refreshNow() {
    try {
      setBusy(true);
      await onRefresh?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white xl:w-4/6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="px-6 py-5">
        <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Plan Details</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{orgName}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 border-t border-gray-200 p-4 sm:p-6 xl:grid-cols-2 dark:border-gray-800">
        <div>
          <ul className="divide-y divide-gray-100 rounded-t-xl border border-gray-200 p-5 dark:divide-gray-800 dark:border-gray-800">
            <li className="py-3 first:pt-0">
              <span className="block text-sm text-gray-500 dark:text-gray-400">Current Plan</span>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">{planLabel}</span>
            </li>

            <li className="py-3">
              <span className="block text-sm text-gray-500 dark:text-gray-400">Status</span>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">{statusLabel}</span>
            </li>

            <li className="py-3">
              <span className="block text-sm text-gray-500 dark:text-gray-400">Trial Ends</span>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">{fmtDate(trialEndsAt)}</span>
            </li>

            <li className="py-3">
              <span className="block text-sm text-gray-500 dark:text-gray-400">Renewal Date</span>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {fmtDate(currentPeriodEnd)}
              </span>
            </li>
          </ul>

          <div className="rounded-b-xl border border-t-0 border-gray-200 p-5 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Billing source</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Stripe</span>
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="h-10" onClick={refreshNow} disabled={busy}>
                Refresh
              </Button>
              <Button variant="outline" className="h-10" onClick={manageSubscription} disabled={busy}>
                Manage in Stripe
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-base font-medium text-gray-800 dark:text-white/90">
            {isFree ? "Choose a plan" : "Change plan / manage"}
          </h3>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Quotes + sending/email/PDF are unlocked when your subscription is Active or Trialing.
          </p>

          {/* Plan selection */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedPlan("starter")}
              className={`rounded-xl border px-4 py-3 text-left text-sm ${
                selectedPlan === "starter"
                  ? "border-brand-500 bg-brand-50 text-gray-900 dark:bg-white/5 dark:text-white"
                  : "border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-transparent dark:text-gray-300"
              }`}
            >
              <div className="font-semibold">Starter</div>
              <div className="text-xs opacity-70">Best for solo trades</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedPlan("pro");
                setWantsTrial(false);
              }}
              className={`rounded-xl border px-4 py-3 text-left text-sm ${
                selectedPlan === "pro"
                  ? "border-brand-500 bg-brand-50 text-gray-900 dark:bg-white/5 dark:text-white"
                  : "border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-transparent dark:text-gray-300"
              }`}
            >
              <div className="font-semibold">Pro</div>
              <div className="text-xs opacity-70">Teams + automation</div>
            </button>
          </div>

          {/* Trial toggle (starter only) */}
          <div className="mb-6 flex items-center justify-between rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">
            <div>
              <div className="font-medium text-gray-800 dark:text-white/90">7-day free trial</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Card required. You can cancel anytime.
              </div>
            </div>

            <label className={`inline-flex items-center gap-2 ${selectedPlan !== "starter" ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                checked={wantsTrial}
                onChange={(e) => setWantsTrial(e.target.checked)}
                disabled={selectedPlan !== "starter"}
              />
              <span className="text-gray-700 dark:text-gray-300">Enable</span>
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="primary"
              className="h-11 w-full"
              onClick={startCheckout}
              disabled={busy}
            >
              {busy
                ? "Redirecting…"
                : isActive
                ? "Change plan / Checkout"
                : wantsTrial && selectedPlan === "starter"
                ? "Start trial"
                : "Subscribe now"}
            </Button>

            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={manageSubscription}
              disabled={busy}
            >
              Manage
            </Button>
          </div>

          {!isActive ? (
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Tip: after checkout, come back here and hit <b>Refresh</b> if it hasn’t updated yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}