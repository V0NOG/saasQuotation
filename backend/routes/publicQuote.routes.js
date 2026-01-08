// backend/routes/publicQuote.routes.js
const express = require("express");
const mongoose = require("mongoose");
const Quote = require("../models/Quote");
const Org = require("../models/Org");
const Job = require("../models/Job"); // ✅ NEW
const { streamQuotePdf } = require("../utils/quotePdf");

const router = express.Router();

function isTokenExpired(q) {
  return q.publicTokenExpiresAt && new Date(q.publicTokenExpiresAt).getTime() <= Date.now();
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.ip || "";
}

function cleanStr(v, max = 200) {
  return String(v || "")
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .slice(0, max);
}

function cleanEmail(v, max = 200) {
  const s = cleanStr(v, max).toLowerCase();
  if (!s) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s;
  return s;
}

function generateJobNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `J-${y}${m}${day}-${rand}`;
}

// GET /api/public/quotes/:token
router.get("/quotes/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ message: "Missing token" });

    const quote = await Quote.findOne({ publicToken: token }).select(
      "_id quoteNumber status title notes pricingMode customerSnapshot lines subtotalExTax taxTotal totalIncTax issueDate validUntil sentAt acceptedAt declinedAt publicTokenExpiresAt lockedAt jobId createdAt updatedAt"
    );

    if (!quote) return res.status(404).json({ message: "Quote not found" });
    if (isTokenExpired(quote)) return res.status(410).json({ message: "Quote link expired" });

    return res.json({ quote });
  } catch (e) {
    console.error("public quote view error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/public/quotes/:token/pdf
router.get("/quotes/:token/pdf", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ message: "Missing token" });

    const quote = await Quote.findOne({ publicToken: token });
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    if (isTokenExpired(quote)) return res.status(410).json({ message: "Quote link expired" });

    const org = quote.orgId ? await Org.findById(quote.orgId).select("name orgName") : null;
    return streamQuotePdf(res, { quote, org, disposition: "inline" });
  } catch (e) {
    console.error("public quote pdf error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/public/quotes/:token/accept (ATOMIC + creates Job)
router.post("/quotes/:token/accept", async (req, res) => {
  const token = String(req.params.token || "").trim();
  if (!token) return res.status(400).json({ message: "Missing token" });

  const session = await mongoose.startSession();
  try {
    let updatedQuote = null;

    await session.withTransaction(async () => {
      const current = await Quote.findOne({ publicToken: token })
        .select("orgId status publicTokenExpiresAt customerSnapshot title notes lines subtotalExTax taxTotal totalIncTax jobId")
        .session(session);

      if (!current) throw Object.assign(new Error("NOT_FOUND"), { http: 404 });
      if (isTokenExpired(current)) throw Object.assign(new Error("EXPIRED"), { http: 410 });

      // idempotent: already accepted
      if (current.status === "accepted") {
        updatedQuote = await Quote.findOne({ publicToken: token }).session(session);
        return;
      }

      if (current.status !== "sent") throw Object.assign(new Error("BAD_STATUS"), { http: 409, status: current.status });

      // If a job already exists (shouldn't, but safe)
      if (current.jobId) {
        const q = await Quote.findOne({ publicToken: token }).session(session);
        updatedQuote = q;
        return;
      }

      const now = new Date();
      const ip = clientIp(req);
      const ua = String(req.headers["user-agent"] || "").slice(0, 300);

      const name = cleanStr(req.body?.name, 120);
      const email = cleanEmail(req.body?.email, 200);
      const note = cleanStr(req.body?.note, 500);

      // Create Job
      let jobNumber = generateJobNumber();
      for (let i = 0; i < 3; i++) {
        // eslint-disable-next-line no-await-in-loop
        const exists = await Job.findOne({ orgId: current.orgId, jobNumber }).select("_id").session(session);
        if (!exists) break;
        jobNumber = generateJobNumber();
      }

      const createdJob = await Job.create(
        [
          {
            orgId: current.orgId,
            createdBy: null, // public acceptance
            quoteId: current._id,
            jobNumber,
            status: "created",
            customerSnapshot: {
              name: current.customerSnapshot?.name || "",
              email: current.customerSnapshot?.email || "",
              phone: current.customerSnapshot?.phone || "",
              address: current.customerSnapshot?.address || "",
            },
            title: current.title || `Job for ${current.customerSnapshot?.name || "Customer"}`,
            notes: current.notes || "",
            lines: Array.isArray(current.lines) ? current.lines : [],
            subtotalExTax: Number(current.subtotalExTax || 0),
            taxTotal: Number(current.taxTotal || 0),
            totalIncTax: Number(current.totalIncTax || 0),
            statusHistory: [
              {
                from: "",
                to: "created",
                at: now,
                actorType: "system",
                actorUserId: null,
                meta: { note: "Created from accepted quote" },
              },
            ],
          },
        ],
        { session }
      );

      const job = createdJob[0];

      // Update Quote => accepted + locked + link jobId
      updatedQuote = await Quote.findOneAndUpdate(
        { publicToken: token, status: "sent", jobId: null },
        {
          $set: {
            status: "accepted",
            acceptedAt: now,
            lockedAt: now,
            jobId: job._id,
          },
          $push: {
            statusHistory: {
              from: "sent",
              to: "accepted",
              at: now,
              actorType: "public",
              actorUserId: null,
              meta: { ip, userAgent: ua, name, email, note },
            },
          },
        },
        { new: true, session }
      );

      if (!updatedQuote) {
        // Quote status changed mid-flight; transaction will rollback unless we handle:
        throw Object.assign(new Error("RACE"), { http: 409 });
      }
    });

    return res.json({ quote: updatedQuote });
  } catch (e) {
    // Handle duplicate job race gracefully
    if (e && e.code === 11000 && String(e.message || "").includes("quoteId")) {
      const q = await Quote.findOne({ publicToken: token });
      return res.json({ quote: q });
    }

    const http = e?.http;
    if (http === 404) return res.status(404).json({ message: "Quote not found" });
    if (http === 410) return res.status(410).json({ message: "Quote link expired" });
    if (http === 409 && e?.status) return res.status(409).json({ message: `Cannot accept a quote in status '${e.status}'` });
    if (http === 409) return res.status(409).json({ message: "Quote status changed. Please refresh." });

    console.error("public quote accept error:", e);
    return res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
});

// POST /api/public/quotes/:token/decline (unchanged, keep your current version)
router.post("/quotes/:token/decline", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ message: "Missing token" });

    const current = await Quote.findOne({ publicToken: token }).select("status publicTokenExpiresAt");
    if (!current) return res.status(404).json({ message: "Quote not found" });
    if (isTokenExpired(current)) return res.status(410).json({ message: "Quote link expired" });

    if (current.status === "declined") {
      const q = await Quote.findOne({ publicToken: token });
      return res.json({ quote: q });
    }

    if (current.status !== "sent") {
      return res.status(409).json({ message: `Cannot decline a quote in status '${current.status}'` });
    }

    const now = new Date();
    const ip = clientIp(req);
    const ua = String(req.headers["user-agent"] || "").slice(0, 300);

    const name = cleanStr(req.body?.name, 120);
    const email = cleanEmail(req.body?.email, 200);
    const note = cleanStr(req.body?.note, 500);

    const updated = await Quote.findOneAndUpdate(
      { publicToken: token, status: "sent" },
      {
        $set: {
          status: "declined",
          declinedAt: now,
        },
        $push: {
          statusHistory: {
            from: "sent",
            to: "declined",
            at: now,
            actorType: "public",
            actorUserId: null,
            meta: { ip, userAgent: ua, name, email, note },
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      const q = await Quote.findOne({ publicToken: token });
      return res.status(409).json({ message: "Quote status changed. Please refresh.", quote: q });
    }

    return res.json({ quote: updated });
  } catch (e) {
    console.error("public quote decline error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;