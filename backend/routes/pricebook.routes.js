// backend/routes/pricebook.routes.js
const express = require("express");
const PriceItem = require("../models/PriceItem");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/pricebook/items?type=service|material&search=&page=&limit=
 */
router.get("/items", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const type = String(req.query.type || "").trim();
    if (!["service", "material"].includes(type)) {
      return res.status(400).json({ message: "type must be 'service' or 'material'" });
    }

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);

    const search = String(req.query.search || "").trim();
    const filter = { orgId, type };

    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: rx }, { description: rx }];
    }

    const [items, total] = await Promise.all([
      PriceItem.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      PriceItem.countDocuments(filter),
    ]);

    return res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (e) {
    console.error("pricebook list error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/pricebook/items
 */
router.post("/items", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const {
      type,
      name,
      description,
      unitPrice,
      taxRate,
      defaultMinutes,
      unit,
      isActive,
    } = req.body || {};

    if (!["service", "material"].includes(type)) {
      return res.status(400).json({ message: "type must be 'service' or 'material'" });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "name is required" });
    }

    const price = Number(unitPrice);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: "unitPrice must be a valid number >= 0" });
    }

    const item = await PriceItem.create({
      orgId,
      createdBy: req.user.id,
      type,
      name: String(name).trim(),
      description: String(description || ""),
      unitPrice: price,
      taxRate: typeof taxRate === "number" ? taxRate : null,
      defaultMinutes: typeof defaultMinutes === "number" ? defaultMinutes : null,
      unit: String(unit || ""),
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    return res.status(201).json({ item });
  } catch (e) {
    console.error("pricebook create error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * PATCH /api/pricebook/items/:id
 */
router.patch("/items/:id", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const updates = req.body || {};

    const allowed = {};
    if (updates.type && ["service", "material"].includes(updates.type)) allowed.type = updates.type;
    if (typeof updates.name === "string") allowed.name = updates.name.trim();
    if (typeof updates.description === "string") allowed.description = updates.description;

    if (updates.unitPrice !== undefined) {
      const price = Number(updates.unitPrice);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ message: "unitPrice must be a valid number >= 0" });
      }
      allowed.unitPrice = price;
    }

    if (updates.taxRate === null) allowed.taxRate = null;
    else if (typeof updates.taxRate === "number") allowed.taxRate = updates.taxRate;

    if (updates.defaultMinutes === null) allowed.defaultMinutes = null;
    else if (typeof updates.defaultMinutes === "number") allowed.defaultMinutes = updates.defaultMinutes;

    if (typeof updates.unit === "string") allowed.unit = updates.unit;
    if (typeof updates.isActive === "boolean") allowed.isActive = updates.isActive;

    const item = await PriceItem.findOneAndUpdate(
      { _id: req.params.id, orgId },
      allowed,
      { new: true }
    );

    if (!item) return res.status(404).json({ message: "Item not found" });

    return res.json({ item });
  } catch (e) {
    console.error("pricebook patch error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * DELETE /api/pricebook/items/:id
 */
router.delete("/items/:id", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const deleted = await PriceItem.findOneAndDelete({ _id: req.params.id, orgId });
    if (!deleted) return res.status(404).json({ message: "Item not found" });

    return res.json({ ok: true });
  } catch (e) {
    console.error("pricebook delete error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;