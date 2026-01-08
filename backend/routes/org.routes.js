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
    const org = await Org.findById(req.user.orgId).select("name currency taxRate branding industry billing");
    if (!org) return res.status(404).json({ message: "Org not found" });

    return res.json({
      billing: org.billing || null,
      org: {
        id: org._id,
        name: org.name,
        currency: org.currency,
        taxRate: org.taxRate,
        branding: org.branding,
        industry: org.industry,
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

    // allow updating currency + branding
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