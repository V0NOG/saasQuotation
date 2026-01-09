// backend/middleware/billing.js
const Org = require("../models/Org");

/**
 * requireActiveBilling(minPlan = "starter")
 * Rules:
 * - Default: block EVERYTHING unless org is trialing/active AND plan >= minPlan
 * - If you pass minPlan = null, it will ONLY require trialing/active (no plan tier check)
 *
 * Use this on all paid features. Leave billing + auth routes unguarded.
 */
function requireActiveBilling(minPlan = "starter") {
  return async function (req, res, next) {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return res.status(401).json({ message: "Unauthorized" });

      const org = await Org.findById(orgId).select("billing");
      if (!org) return res.status(404).json({ message: "Org not found" });

      const billing = org.billing || {};
      const status = String(billing.status || "free");
      const plan = String(billing.plan || "free");
      const trialEndsAt = billing.trialEndsAt ? new Date(billing.trialEndsAt) : null;

      const rank = { free: 0, starter: 1, pro: 2, enterprise: 3 };

      // Must be active or trialing
      const isActive = status === "active";
      const isTrialing = status === "trialing";

      // Optional: expire trial if trialEndsAt is past
      const trialExpired =
        isTrialing &&
        trialEndsAt instanceof Date &&
        !Number.isNaN(trialEndsAt.getTime()) &&
        trialEndsAt.getTime() < Date.now();

      if (!isActive && !isTrialing) {
        console.log("[billing] BLOCK", {
          orgId,
          requiredPlan: minPlan,
          status,
          plan,
          trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
          path: req.originalUrl,
        });
        return res.status(402).json({
          message: "Subscription or trial required",
          billing: { status, plan, trialEndsAt },
        });
      }

      if (trialExpired) {
        console.log("[billing] BLOCK (trial expired)", {
          orgId,
          requiredPlan: minPlan,
          status,
          plan,
          trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
          path: req.originalUrl,
        });
        return res.status(402).json({
          message: "Trial expired. Please subscribe to continue.",
          billing: { status, plan, trialEndsAt },
        });
      }

      // Plan tier gating (starter/pro)
      if (minPlan) {
        if ((rank[plan] ?? 0) < (rank[minPlan] ?? 0)) {
          console.log("[billing] BLOCK (plan)", {
            orgId,
            requiredPlan: minPlan,
            status,
            plan,
            trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
            path: req.originalUrl,
          });
          return res.status(402).json({
            message: `Plan upgrade required (${minPlan})`,
            billing: { status, plan, trialEndsAt },
          });
        }
      }

      req.orgBilling = { status, plan, trialEndsAt };
      return next();
    } catch (e) {
      console.error("requireActiveBilling error:", e);
      return res.status(500).json({ message: "Server error" });
    }
  };
}

module.exports = { requireActiveBilling };