const express = require("express");
const Org = require("../models/Org");
const { stripe } = require("../utils/stripe");

const router = express.Router();

// IMPORTANT: this route must use express.raw in server.js
router.post("/stripe", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return res.status(500).send("Webhook not configured");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
    console.log("✅ Stripe webhook received:", event.type);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Helpers
    const setOrgBillingFromSubscription = async (subscription) => {
      const customerId = subscription.customer;
      const subId = subscription.id;

      const priceId =
        subscription.items?.data?.[0]?.price?.id || "";

      const plan =
        priceId === process.env.STRIPE_PRICE_PRO
          ? "pro"
          : priceId === process.env.STRIPE_PRICE_STARTER
          ? "starter"
          : "free";

      const status = subscription.status; // active, trialing, past_due, canceled, unpaid...

      const org =
        (subscription.metadata?.orgId
          ? await Org.findById(subscription.metadata.orgId)
          : null) || (await Org.findOne({ "billing.stripeCustomerId": customerId }));

      if (!org) return;

      org.billing = org.billing || {};
      org.billing.stripeCustomerId = String(customerId);
      org.billing.stripeSubscriptionId = String(subId);
      org.billing.plan = plan;

      // normalize to your enum
      if (status === "active") org.billing.status = "active";
      else if (status === "trialing") org.billing.status = "trialing";
      else if (status === "past_due" || status === "unpaid") org.billing.status = "past_due";
      else if (status === "canceled") org.billing.status = "canceled";
      else org.billing.status = "free"; // ✅ safest fallback

      if (subscription.current_period_end) {
        org.billing.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      }

      if (subscription.trial_end) {
        org.billing.trialEndsAt = new Date(subscription.trial_end * 1000);
      }

      await org.save();
    };

    switch (event.type) {
      case "checkout.session.completed": {
        // After checkout completes, fetch the subscription and sync
        const session = event.data.object;

        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await setOrgBillingFromSubscription(subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await setOrgBillingFromSubscription(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const org = await Org.findOne({ "billing.stripeCustomerId": customerId });
        if (org) {
          org.billing = org.billing || {};
          org.billing.status = "past_due";
          await org.save();
        }
        break;
      }

      default:
        break;
    }

    return res.json({ received: true });
  } catch (e) {
    console.error("webhook handler error:", e);
    return res.status(500).send("Webhook handler failed");
  }
});

module.exports = router;