// backend/routes/billing.routes.js
const express = require("express");
const Org = require("../models/Org");
const { requireAuth } = require("../middleware/auth");
const { stripe } = require("../utils/stripe");

const router = express.Router();

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173").trim();

function planFromPrice(priceId) {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return "free";
}

async function getOrCreateCustomer(org) {
  if (org.billing?.stripeCustomerId) return org.billing.stripeCustomerId;

  const customer = await stripe.customers.create({
    name: org.name,
    metadata: { orgId: String(org._id) },
  });

  org.billing = org.billing || {};
  org.billing.stripeCustomerId = customer.id;
  await org.save();

  return customer.id;
}

async function getCustomerIdIfExists(orgId) {
  const org = await Org.findById(orgId).select("billing name");
  if (!org) return { org: null, customerId: null };

  const customerId = org.billing?.stripeCustomerId ? String(org.billing.stripeCustomerId) : null;
  return { org, customerId };
}

router.get("/summary", requireAuth, async (req, res) => {
  try {
    const { org, customerId } = await getCustomerIdIfExists(req.user.orgId);
    if (!org) return res.status(404).json({ message: "Org not found" });

    if (!customerId) {
      return res.json({ customer: null, defaultPaymentMethod: null });
    }

    const customer = await stripe.customers.retrieve(customerId);

    const pmList = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 10,
    });

    let defaultPm = null;

    const defaultPmId = customer?.invoice_settings?.default_payment_method
      ? String(customer.invoice_settings.default_payment_method)
      : null;

    if (defaultPmId) {
      const found = pmList.data.find((p) => String(p.id) === defaultPmId);
      if (found) defaultPm = found;
    }
    if (!defaultPm && pmList.data.length > 0) defaultPm = pmList.data[0];

    const defaultPaymentMethod = defaultPm
      ? {
          id: defaultPm.id,
          brand: defaultPm.card?.brand || "",
          last4: defaultPm.card?.last4 || "",
          expMonth: defaultPm.card?.exp_month || null,
          expYear: defaultPm.card?.exp_year || null,
        }
      : null;

    return res.json({
      customer: { id: customer.id, name: customer.name || "", email: customer.email || "" },
      defaultPaymentMethod,
    });
  } catch (e) {
    console.error("billing summary error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/invoices", requireAuth, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));

    const { org, customerId } = await getCustomerIdIfExists(req.user.orgId);
    if (!org) return res.status(404).json({ message: "Org not found" });

    if (!customerId) return res.json({ items: [] });

    const invoices = await stripe.invoices.list({ customer: customerId, limit });

    const items = (invoices.data || []).map((inv) => ({
      id: inv.id,
      number: inv.number || "",
      status: inv.status || "",
      created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      currency: inv.currency || "",
      amountDue: typeof inv.amount_due === "number" ? inv.amount_due : 0,
      amountPaid: typeof inv.amount_paid === "number" ? inv.amount_paid : 0,
      total: typeof inv.total === "number" ? inv.total : 0,
      hostedInvoiceUrl: inv.hosted_invoice_url || "",
      invoicePdf: inv.invoice_pdf || "",
    }));

    return res.json({ items });
  } catch (e) {
    console.error("billing invoices error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/billing/checkout
 * body: { plan: "starter" | "pro", trial?: boolean }
 */
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const { plan, trial } = req.body || {};

    const isPro = plan === "pro";
    const priceId = isPro ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_STARTER;

    if (!priceId) {
      return res.status(400).json({ message: "Stripe price id not configured for plan" });
    }

    const org = await Org.findById(req.user.orgId);
    if (!org) return res.status(404).json({ message: "Org not found" });

    const customerId = await getOrCreateCustomer(org);

    // ✅ Only allow trial on starter
    const wantsTrial = Boolean(trial) && !isPro;
    const resolvedPlan = planFromPrice(priceId);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      payment_method_collection: "always",

      // ✅ IMPORTANT: put metadata on the SUBSCRIPTION, not just the session
      subscription_data: {
        ...(wantsTrial ? { trial_period_days: 7 } : {}),
        metadata: {
          orgId: String(org._id),
          plan: resolvedPlan,
          trial: wantsTrial ? "true" : "false",
        },
      },

      // (optional) keep session metadata too (useful for debugging)
      metadata: {
        orgId: String(org._id),
        plan: resolvedPlan,
        trial: wantsTrial ? "true" : "false",
      },

      success_url: `${FRONTEND_URL}/billing?success=1`,
      cancel_url: `${FRONTEND_URL}/billing?canceled=1`,
    });

    return res.json({ url: session.url });
  } catch (e) {
    console.error("checkout error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/portal", requireAuth, async (req, res) => {
  try {
    const org = await Org.findById(req.user.orgId);
    if (!org) return res.status(404).json({ message: "Org not found" });

    const customerId = await getOrCreateCustomer(org);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND_URL}/billing`,
    });

    return res.json({ url: portalSession.url });
  } catch (e) {
    console.error("portal error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;