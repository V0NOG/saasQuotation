import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import BillingPlan from "../../components/ecommerce/billing/BillingPlan";
import BillingInfo from "../../components/ecommerce/billing/BillingInfo";
import PaymentMethod from "../../components/ecommerce/billing/PaymentMethod";
import InvoiceTable from "../../components/ecommerce/billing/InvoiceTable";
import { authApi } from "../../api/authApi";
import { useAuth } from "../../context/AuthContext";

type BillingState = {
  plan: "free" | "starter" | "pro" | "enterprise";
  status: "trialing" | "active" | "past_due" | "canceled" | "free";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

export default function Billing() {
  const { org } = useAuth();
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const data = await authApi.billingMe();
        if (!mounted) return;
        setBilling(data.billing || null);
      } catch {
        if (!mounted) return;
        setBilling(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

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
          <div className="mb-6 flex flex-col gap-6 xl:flex-row">
            <BillingPlan orgName={org?.name || ""} billing={billing} />
            <BillingInfo />
          </div>

          {/* Keep these template sections for now */}
          <PaymentMethod />
          <InvoiceTable />
        </>
      )}
    </>
  );
}