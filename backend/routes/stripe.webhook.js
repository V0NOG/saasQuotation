// backend/routes/stripe.webhook.js
const express = require("express");
const Org = require("../models/Org");
const { stripe } = require("../utils/stripe");

const router = express.Router();

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
    const planFromPriceId = (priceId) => {
      if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
      if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
      return "free";
    };

    const normalizeStatus = (stripeStatus) => {
      if (stripeStatus === "active") return "active";
      if (stripeStatus === "trialing") return "trialing";
      if (stripeStatus === "past_due" || stripeStatus === "unpaid") return "past_due";
      if (stripeStatus === "canceled") return "canceled";
      return "free";
    };

    const setOrgBillingFromSubscription = async (subscription, fallbackOrgId = null) => {
      const customerId = String(subscription.customer || "");
      const subId = String(subscription.id || "");
      const priceId = subscription.items?.data?.[0]?.price?.id || "";

      const plan = planFromPriceId(priceId);
      const status = normalizeStatus(subscription.status);

      // Try to find org in the most reliable order:
      // 1) subscription.metadata.orgId
      // 2) fallbackOrgId (from checkout session metadata)
      // 3) by stripeCustomerId
      let org =
        (subscription.metadata?.orgId ? await Org.findById(subscription.metadata.orgId) : null) ||
        (fallbackOrgId ? await Org.findById(fallbackOrgId) : null) ||
        (customerId ? await Org.findOne({ "billing.stripeCustomerId": customerId }) : null);

      if (!org) return;

      org.billing = org.billing || {};
      org.billing.stripeCustomerId = customerId;
      org.billing.stripeSubscriptionId = subId;
      org.billing.plan = plan;
      org.billing.status = status;

      if (subscription.current_period_end) {
        org.billing.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      } else {
        org.billing.currentPeriodEnd = null;
      }

      if (subscription.trial_end) {
        org.billing.trialEndsAt = new Date(subscription.trial_end * 1000);
      } else {
        org.billing.trialEndsAt = null;
      }

      await org.save();
      console.log("✅ Org billing synced", {
        orgId: String(org._id),
        customerId,
        subId,
        plan,
        status,
      });
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);

          // ✅ use session.metadata.orgId as fallback if subscription metadata is missing
          const fallbackOrgId = session?.metadata?.orgId ? String(session.metadata.orgId) : null;
          await setOrgBillingFromSubscription(subscription, fallbackOrgId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await setOrgBillingFromSubscription(subscription, null);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = String(invoice.customer || "");
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