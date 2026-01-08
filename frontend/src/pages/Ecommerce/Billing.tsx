// frontend/src/pages/Ecommerce/Billing.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import BillingPlan from "../../components/ecommerce/billing/BillingPlan";
import BillingInfo from "../../components/ecommerce/billing/BillingInfo";
import PaymentMethod from "../../components/ecommerce/billing/PaymentMethod";
import InvoiceTable from "../../components/ecommerce/billing/InvoiceTable";
import { authApi } from "../../api/authApi";
import { useAuth } from "../../context/AuthContext";

export type BillingState = {
  plan: "free" | "starter" | "pro" | "enterprise";
  status: "trialing" | "active" | "past_due" | "canceled" | "free";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
};

const DEFAULT_BILLING: BillingState = {
  plan: "free",
  status: "free",
  trialEndsAt: null,
  currentPeriodEnd: null,
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function Billing() {
  const { org } = useAuth();
  const location = useLocation();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const success = params.get("success") === "1";

  const [billing, setBilling] = useState<BillingState>(DEFAULT_BILLING);
  const [loading, setLoading] = useState(true);

  async function fetchBilling(): Promise<BillingState> {
    const data = await authApi.billingMe();
    const b = data?.billing || {};

    const next: BillingState = {
      plan: (b.plan as any) || "free",
      status: (b.status as any) || "free",
      trialEndsAt: b.trialEndsAt ?? null,
      currentPeriodEnd: b.currentPeriodEnd ?? null,
      stripeCustomerId: b.stripeCustomerId || "",
      stripeSubscriptionId: b.stripeSubscriptionId || "",
    };

    setBilling(next);
    return next;
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        // initial load
        let current = await fetchBilling();

        // ✅ if returning from Stripe, poll briefly for webhook propagation
        if (success) {
          for (let i = 0; i < 6; i++) {
            if (!mounted) return;
            if (current.status === "active" || current.status === "trialing") break;

            await sleep(1500);
            current = await fetchBilling();
          }
        }
      } catch {
        if (!mounted) return;
        setBilling(DEFAULT_BILLING);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  const isActive = billing.status === "active" || billing.status === "trialing";

  return (
    <>
      <PageMeta title="Billing | Quotify" description="Manage your subscription and billing." />
      <PageBreadcrumb pageTitle="Billing" />

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading billing info…</p>
        </div>
      ) : (
        <>
          {success && !isActive ? (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              We’re confirming your subscription with Stripe… this usually updates within a few seconds.
            </div>
          ) : null}

          <div className="mb-6 flex flex-col gap-6 xl:flex-row">
            <BillingPlan orgName={org?.name || ""} billing={billing} onRefresh={fetchBilling} />
            <BillingInfo />
          </div>

          <PaymentMethod />
          <InvoiceTable />
        </>
      )}
    </>
  );
}