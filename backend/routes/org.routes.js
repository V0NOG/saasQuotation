// backend/routes/org.routes.js
const express = require("express");
const Org = require("../models/Org");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

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
    const org = await Org.findById(req.user.orgId).select("billing name currency taxRate branding");
    if (!org) return res.status(404).json({ message: "Org not found" });

    // ✅ IMPORTANT: return the actual stored billing values, not a schema definition
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
        // you can include these if you want (optional)
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