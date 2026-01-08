import Button from "../../ui/button/Button";
import { authApi } from "../../../api/authApi";
import { useState } from "react";

type BillingState = {
  plan: "free" | "starter" | "pro" | "enterprise";
  status: "trialing" | "active" | "past_due" | "canceled" | "free";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

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
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function BillingPlan({
  orgName,
  billing,
}: {
  orgName: string;
  billing: BillingState | null;
}) {
  const plan = billing?.plan ?? "free";
  const status = billing?.status ?? "free";
  const trialEndsAt = billing?.trialEndsAt ?? null;
  const currentPeriodEnd = billing?.currentPeriodEnd ?? null;

  const trialDays = daysLeft(trialEndsAt);

  const [busy, setBusy] = useState(false);

  async function goUpgrade() {
    try {
      setBusy(true);
      const { url } = await authApi.createCheckoutSession("pro");
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

  const label =
    status === "trialing"
      ? trialDays !== null
        ? `Trial (${trialDays} days left)`
        : "Trial"
      : status === "active"
      ? "Active"
      : status === "past_due"
      ? "Past due"
      : status === "canceled"
      ? "Canceled"
      : "Free";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white xl:w-4/6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="px-6 py-5">
        <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
          Plan Details
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{orgName}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 border-t border-gray-200 p-4 sm:p-6 lg:grid-cols-1 xl:grid-cols-2 dark:border-gray-800">
        <div>
          <ul className="divide-y divide-gray-100 rounded-t-xl border border-gray-200 p-5 dark:divide-gray-800 dark:border-gray-800">
            <li className="py-3 first:pt-0">
              <span className="block space-y-1.5 text-sm font-normal text-gray-500 dark:text-gray-400">
                Current Plan
              </span>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-400">
                {plan.toUpperCase()}
              </span>
            </li>

            <li className="py-3">
              <span className="block space-y-1.5 text-sm font-normal text-gray-500 dark:text-gray-400">
                Status
              </span>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-400">
                {label}
              </span>
            </li>

            <li className="py-3">
              <span className="block space-y-1.5 text-sm font-normal text-gray-500 dark:text-gray-400">
                Trial Ends
              </span>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-400">
                {fmtDate(trialEndsAt)}
              </span>
            </li>

            <li className="py-3">
              <span className="block space-y-1.5 text-sm font-normal text-gray-500 dark:text-gray-400">
                Renewal Date
              </span>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-400">
                {fmtDate(currentPeriodEnd)}
              </span>
            </li>
          </ul>

          <div className="rounded-b-xl border border-t-0 border-gray-200 p-5 dark:border-gray-800">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-400">
                Usage
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-400">
                Coming soon
              </span>
            </div>
            <div className="relative h-2 w-full rounded-sm bg-gray-200 dark:bg-gray-800">
              <div className="bg-brand-500 absolute left-0 h-full w-[10%] rounded-sm" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-6 text-base font-medium text-gray-800 dark:text-white/90">
            Next steps
          </h3>

          <ul className="space-y-3.5 text-sm text-gray-500 dark:text-gray-400">
            <li>• Stripe checkout (next phase)</li>
            <li>• Feature gating by plan</li>
            <li>• Invoice history from Stripe</li>
          </ul>

          <div className="mt-24 flex w-full flex-col items-center justify-between gap-3 sm:flex-row">
            <Button variant="outline" className="w-full h-11" onClick={manageSubscription} disabled={busy}>
              Manage
            </Button>
            <Button variant="primary" className="w-full h-11" onClick={goUpgrade} disabled={busy}>
              {busy ? "Redirecting…" : "Upgrade"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}