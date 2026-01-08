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

/**
 * POST /api/billing/checkout
 * body: { plan: "starter" | "pro" }
 */
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const { plan } = req.body || {};
    const priceId =
      plan === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_STARTER;

    if (!priceId) {
      return res.status(400).json({ message: "Stripe price id not configured for plan" });
    }

    const org = await Org.findById(req.user.orgId);
    if (!org) return res.status(404).json({ message: "Org not found" });

    const customerId = await getOrCreateCustomer(org);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,

      // important for webhook mapping
      metadata: {
        orgId: String(org._id),
        plan: planFromPrice(priceId),
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

/**
 * POST /api/billing/portal
 * returns Stripe customer portal URL
 */
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