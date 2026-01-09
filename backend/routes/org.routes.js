// backend/routes/org.routes.js
const express = require("express");
const Org = require("../models/Org");
const { requireAuth } = require("../middleware/auth");
const { stripe } = require("../utils/stripe");

const router = express.Router();

async function reconcileBillingFromStripe(org) {
  const customerId = String(org?.billing?.stripeCustomerId || "").trim();
  if (!customerId) return org;

  // If already active/trialing, don’t spam Stripe on every refresh
  const currentStatus = String(org.billing?.status || "free");
  const currentPlan = String(org.billing?.plan || "free");
  const hasDates = !!org.billing?.currentPeriodEnd || !!org.billing?.trialEndsAt;

  if ((currentStatus === "active" || currentStatus === "trialing") && (currentPlan !== "free") && hasDates) {
    return org;
  }

  // Find the latest subscription for this customer
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 5,
  });

  const sub = (subs.data || [])[0];
  if (!sub) return org;

  const priceId = sub.items?.data?.[0]?.price?.id || "";

  const plan =
    priceId === process.env.STRIPE_PRICE_PRO
      ? "pro"
      : priceId === process.env.STRIPE_PRICE_STARTER
      ? "starter"
      : "free";

  const stripeStatus = String(sub.status || "canceled");
  const status =
    stripeStatus === "active"
      ? "active"
      : stripeStatus === "trialing"
      ? "trialing"
      : stripeStatus === "past_due" || stripeStatus === "unpaid"
      ? "past_due"
      : stripeStatus === "canceled"
      ? "canceled"
      : "free";

  org.billing = org.billing || {};
  org.billing.plan = plan;
  org.billing.status = status;
  org.billing.stripeSubscriptionId = String(sub.id || "");
  org.billing.currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  org.billing.trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;

  await org.save();
  console.log("✅ billing reconciled on read", {
    orgId: String(org._id),
    customerId,
    subscriptionId: String(sub.id || ""),
    plan,
    status,
  });

  return org;
}

router.get("/me", requireAuth, async (req, res) => {
  try {
    const org = await Org.findById(req.user.orgId);
    if (!org) return res.status(404).json({ message: "Org not found" });
    return res.json({ org });
  } catch (e) {
    console.error("org me error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/billing", requireAuth, async (req, res) => {
  try {
    let org = await Org.findById(req.user.orgId).select("billing name currency taxRate branding");
    if (!org) return res.status(404).json({ message: "Org not found" });

    // ✅ Fallback sync if webhook didn’t update yet
    org = await reconcileBillingFromStripe(org);

    const billing = org.billing || {
      plan: "free",
      status: "free",
      trialEndsAt: null,
      stripeCustomerId: "",
      stripeSubscriptionId: "",
      currentPeriodEnd: null,
    };

    return res.json({
      org: {
        id: org._id,
        name: org.name,
        currency: org.currency,
        taxRate: org.taxRate,
        branding: org.branding,
      },
      billing: {
        plan: billing.plan || "free",
        status: billing.status || "free",
        trialEndsAt: billing.trialEndsAt || null,
        currentPeriodEnd: billing.currentPeriodEnd || null,
        stripeCustomerId: billing.stripeCustomerId || "",
        stripeSubscriptionId: billing.stripeSubscriptionId || "",
      },
    });
  } catch (e) {
    console.error("org billing error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

router.patch("/me", requireAuth, async (req, res) => {
  try {
    const updates = req.body || {};

    const allowed = {};
    if (typeof updates.currency === "string") allowed.currency = updates.currency;
    if (typeof updates.taxRate === "number") allowed.taxRate = updates.taxRate;
    if (updates.branding && typeof updates.branding === "object") allowed.branding = updates.branding;

    const org = await Org.findByIdAndUpdate(req.user.orgId, allowed, { new: true });
    return res.json({ org });
  } catch (e) {
    console.error("org patch error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;