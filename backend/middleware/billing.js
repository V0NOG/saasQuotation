// backend/middleware/billing.js
const Org = require("../models/Org");

/**
 * requireActiveBilling
 * Allows: active OR trialing
 * Blocks: free / canceled / past_due
 *
 * Optional: requiredPlan can be "starter" or "pro"
 */
function requireActiveBilling(requiredPlan = null) {
  return async function (req, res, next) {
    try {
      const org = await Org.findById(req.user.orgId).select("billing");
      if (!org) return res.status(404).json({ message: "Org not found" });

      const billing = org.billing || {};
      const status = billing.status || "free";
      const plan = billing.plan || "free";

      const okStatus = status === "active" || status === "trialing";
      if (!okStatus) {
        return res.status(402).json({
          message: "Subscription required",
          billing: { status, plan },
        });
      }

      // Optional plan gating (starter/pro tiers)
      if (requiredPlan) {
        const rank = { free: 0, starter: 1, pro: 2, enterprise: 3 };
        if ((rank[plan] ?? 0) < (rank[requiredPlan] ?? 0)) {
          return res.status(402).json({
            message: `Plan upgrade required (${requiredPlan})`,
            billing: { status, plan },
          });
        }
      }

      // attach for downstream use
      req.orgBilling = { status, plan };
      return next();
    } catch (e) {
      console.error("requireActiveBilling error:", e);
      return res.status(500).json({ message: "Server error" });
    }
  };
}

module.exports = { requireActiveBilling };