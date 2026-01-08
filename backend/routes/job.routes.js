// backend/routes/job.routes.js
const express = require("express");
const mongoose = require("mongoose");
const Job = require("../models/Job");
const { requireAuth } = require("../middleware/auth");
const { requireActiveBilling } = require("../middleware/billing");

const router = express.Router();

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requireValidObjectId(id) {
  return mongoose.isValidObjectId(id);
}

// GET /api/jobs
router.get("/", requireAuth, requireActiveBilling("starter"), async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);

    const status = String(req.query.status || "").trim();
    const search = String(req.query.search || "").trim();

    const filter = { orgId };
    if (["created", "scheduled", "in_progress", "completed", "canceled"].includes(status)) {
      filter.status = status;
    }

    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { jobNumber: rx },
        { title: rx },
        { "customerSnapshot.name": rx },
        { "customerSnapshot.email": rx },
      ];
    }

    const [items, total] = await Promise.all([
      Job.find(filter)
        .sort({ createdAt: -1 })
        .select("_id jobNumber status title customerSnapshot scheduledStart scheduledEnd totalIncTax quoteId createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
      Job.countDocuments(filter),
    ]);

    return res.json({ items, page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) });
  } catch (e) {
    console.error("jobs list error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/jobs/:id
router.get("/:id", requireAuth, requireActiveBilling("starter"), async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid job id" });

    const orgId = req.user.orgId;
    const job = await Job.findOne({ _id: req.params.id, orgId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    return res.json({ job });
  } catch (e) {
    console.error("jobs read error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;