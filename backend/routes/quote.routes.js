// backend/routes/quote.routes.js
const express = require("express");
const Quote = require("../models/Quote");
const Org = require("../models/Org");
const { requireAuth } = require("../middleware/auth");
const { computeQuoteTotals } = require("../utils/quoteMath");

const router = express.Router();

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generateQuoteNumber() {
  // Simple unique-ish number per org; uniqueness is enforced by DB index.
  // Example: Q-20260107-4F8A
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `Q-${y}${m}${day}-${rand}`;
}

// GET /api/quotes?search=&status=&page=&limit=
router.get("/", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);

    const status = String(req.query.status || "").trim();
    const search = String(req.query.search || "").trim();

    const filter = { orgId };
    if (["draft", "sent", "accepted", "declined"].includes(status)) filter.status = status;

    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { quoteNumber: rx },
        { title: rx },
        { "customerSnapshot.name": rx },
        { "customerSnapshot.email": rx },
      ];
    }

    const [items, total] = await Promise.all([
      Quote.find(filter)
        .sort({ createdAt: -1 })
        .select("_id quoteNumber status title customerSnapshot pricingMode subtotalExTax taxTotal totalIncTax createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
      Quote.countDocuments(filter),
    ]);

    return res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (e) {
    console.error("quotes list error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/quotes/:id
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const quote = await Quote.findOne({ _id: req.params.id, orgId });
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    return res.json({ quote });
  } catch (e) {
    console.error("quotes read error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/quotes
router.post("/", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const org = await Org.findById(orgId).select("taxRate");
    const orgTaxRate = org?.taxRate ?? 0.1;

    const {
      customerId = null,
      customerSnapshot = {},
      title = "",
      notes = "",
      pricingMode = "exclusive",
      status = "draft",
      issueDate,
      validUntil,
      lines = [],
    } = req.body || {};

    const safePricingMode = pricingMode === "inclusive" ? "inclusive" : "exclusive";
    const safeStatus = ["draft", "sent", "accepted", "declined"].includes(status) ? status : "draft";

    const { computedLines, subtotalExTax, taxTotal, totalIncTax } = computeQuoteTotals({
      lines,
      orgTaxRate,
    });

    // try until unique (rare collision)
    let quoteNumber = generateQuoteNumber();
    for (let i = 0; i < 3; i++) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await Quote.findOne({ orgId, quoteNumber }).select("_id");
      if (!exists) break;
      quoteNumber = generateQuoteNumber();
    }

    const created = await Quote.create({
      orgId,
      createdBy: req.user.id,
      quoteNumber,
      status: safeStatus,

      customerId: customerId || null,
      customerSnapshot: {
        name: String(customerSnapshot?.name || ""),
        email: String(customerSnapshot?.email || ""),
        phone: String(customerSnapshot?.phone || ""),
        address: String(customerSnapshot?.address || ""),
      },

      title: String(title || ""),
      notes: String(notes || ""),

      pricingMode: safePricingMode,
      lines: computedLines,

      subtotalExTax,
      taxTotal,
      totalIncTax,

      issueDate: issueDate ? new Date(issueDate) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
    });

    return res.status(201).json({ quote: created });
  } catch (e) {
    console.error("quotes create error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/quotes/:id
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const org = await Org.findById(orgId).select("taxRate");
    const orgTaxRate = org?.taxRate ?? 0.1;

    const updates = req.body || {};

    const allowed = {};
    if (typeof updates.title === "string") allowed.title = updates.title;
    if (typeof updates.notes === "string") allowed.notes = updates.notes;

    if (updates.pricingMode === "exclusive" || updates.pricingMode === "inclusive") {
      allowed.pricingMode = updates.pricingMode;
    }
    if (["draft", "sent", "accepted", "declined"].includes(updates.status)) {
      allowed.status = updates.status;
    }

    if (updates.customerId !== undefined) allowed.customerId = updates.customerId || null;
    if (updates.customerSnapshot && typeof updates.customerSnapshot === "object") {
      allowed.customerSnapshot = {
        name: String(updates.customerSnapshot.name || ""),
        email: String(updates.customerSnapshot.email || ""),
        phone: String(updates.customerSnapshot.phone || ""),
        address: String(updates.customerSnapshot.address || ""),
      };
    }

    if (updates.issueDate !== undefined) allowed.issueDate = updates.issueDate ? new Date(updates.issueDate) : new Date();
    if (updates.validUntil !== undefined) allowed.validUntil = updates.validUntil ? new Date(updates.validUntil) : null;

    if (Array.isArray(updates.lines)) {
      const { computedLines, subtotalExTax, taxTotal, totalIncTax } = computeQuoteTotals({
        lines: updates.lines,
        orgTaxRate,
      });
      allowed.lines = computedLines;
      allowed.subtotalExTax = subtotalExTax;
      allowed.taxTotal = taxTotal;
      allowed.totalIncTax = totalIncTax;
    }

    const quote = await Quote.findOneAndUpdate({ _id: req.params.id, orgId }, allowed, { new: true });
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    return res.json({ quote });
  } catch (e) {
    console.error("quotes patch error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/quotes/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const deleted = await Quote.findOneAndDelete({ _id: req.params.id, orgId });
    if (!deleted) return res.status(404).json({ message: "Quote not found" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("quotes delete error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;