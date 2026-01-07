// backend/routes/customer.routes.js
const express = require("express");
const Customer = require("../models/Customer");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/customers
 * Query:
 *  - search (optional)
 *  - page (default 1)
 *  - limit (default 20)
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);

    const search = String(req.query.search || "").trim();
    const filter = { orgId };

    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const [items, total] = await Promise.all([
      Customer.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Customer.countDocuments(filter),
    ]);

    return res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (e) {
    console.error("customers list error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/customers
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const { name, email, phone, address, notes, tags } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const customer = await Customer.create({
      orgId,
      createdBy: req.user.id,
      name: String(name).trim(),
      email: String(email || "").trim().toLowerCase(),
      phone: String(phone || "").trim(),
      address: typeof address === "object" && address ? address : undefined,
      notes: String(notes || ""),
      tags: Array.isArray(tags) ? tags : [],
    });

    return res.status(201).json({ customer });
  } catch (e) {
    console.error("customers create error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/customers/:id
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const customer = await Customer.findOne({ _id: req.params.id, orgId });
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    return res.json({ customer });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * PATCH /api/customers/:id
 */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const updates = req.body || {};

    const allowed = {};
    if (typeof updates.name === "string") allowed.name = updates.name.trim();
    if (typeof updates.email === "string") allowed.email = updates.email.trim().toLowerCase();
    if (typeof updates.phone === "string") allowed.phone = updates.phone.trim();
    if (typeof updates.notes === "string") allowed.notes = updates.notes;
    if (updates.address && typeof updates.address === "object") allowed.address = updates.address;
    if (Array.isArray(updates.tags)) allowed.tags = updates.tags;

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, orgId },
      allowed,
      { new: true }
    );

    if (!customer) return res.status(404).json({ message: "Customer not found" });

    return res.json({ customer });
  } catch (e) {
    console.error("customers patch error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * DELETE /api/customers/:id
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const deleted = await Customer.findOneAndDelete({ _id: req.params.id, orgId });
    if (!deleted) return res.status(404).json({ message: "Customer not found" });

    return res.json({ ok: true });
  } catch (e) {
    console.error("customers delete error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;