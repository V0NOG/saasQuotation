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

const STATUSES = ["created", "scheduled", "in_progress", "completed", "canceled"];

function isValidStatus(s) {
  return STATUSES.includes(s);
}

function canTransition(from, to) {
  if (!isValidStatus(from) || !isValidStatus(to)) return false;
  if (from === to) return true;

  // Simple, sane lifecycle:
  // created -> scheduled -> in_progress -> completed
  // created/scheduled/in_progress -> canceled
  const allowed = {
    created: ["scheduled", "canceled"],
    scheduled: ["in_progress", "canceled"],
    in_progress: ["completed", "canceled"],
    completed: [],
    canceled: [],
  };

  return (allowed[from] || []).includes(to);
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
    if (STATUSES.includes(status)) {
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

    return res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
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

/**
 * PATCH /api/jobs/:id
 * body may include:
 * - status
 * - scheduledStart, scheduledEnd (ISO strings or null)
 * - title
 * - notes
 */
router.patch("/:id", requireAuth, requireActiveBilling("starter"), async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid job id" });

    const orgId = req.user.orgId;
    const userId = req.user.id;

    const job = await Job.findOne({ _id: req.params.id, orgId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const updates = req.body || {};

    // ---- status transition ----
    if (updates.status !== undefined) {
      const next = String(updates.status || "").trim();
      if (!isValidStatus(next)) return res.status(400).json({ message: "Invalid status" });

      const from = String(job.status || "created");
      if (!canTransition(from, next)) {
        return res.status(409).json({ message: `Invalid status transition '${from}' -> '${next}'` });
      }

      if (from !== next) {
        job.statusHistory.push({
          from,
          to: next,
          at: new Date(),
          actorType: "user",
          actorUserId: userId,
          meta: { note: String(updates.statusNote || "") },
        });
        job.status = next;
      }
    }

    // ---- scheduling ----
    if (updates.scheduledStart !== undefined) {
      job.scheduledStart = updates.scheduledStart ? new Date(updates.scheduledStart) : null;
    }
    if (updates.scheduledEnd !== undefined) {
      job.scheduledEnd = updates.scheduledEnd ? new Date(updates.scheduledEnd) : null;
    }

    if (job.scheduledStart && job.scheduledEnd && job.scheduledEnd < job.scheduledStart) {
      return res.status(400).json({ message: "scheduledEnd cannot be before scheduledStart" });
    }

    // ---- basic fields ----
    if (typeof updates.title === "string") job.title = updates.title;
    if (typeof updates.notes === "string") job.notes = updates.notes;

    await job.save();
    return res.json({ job });
  } catch (e) {
    console.error("jobs patch error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;