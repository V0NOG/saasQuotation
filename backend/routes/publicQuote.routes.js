// backend/routes/publicQuote.routes.js
const express = require("express");
const Quote = require("../models/Quote");
const Org = require("../models/Org");
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
  // lightweight sanity check (not strict RFC; good enough for audit trails)
  if (!s) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s; // store what they gave (still useful)
  return s;
}

// GET /api/public/quotes/:token
router.get("/quotes/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ message: "Missing token" });

    const quote = await Quote.findOne({ publicToken: token }).select(
      "_id quoteNumber status title notes pricingMode customerSnapshot lines subtotalExTax taxTotal totalIncTax issueDate validUntil sentAt acceptedAt declinedAt publicTokenExpiresAt lockedAt createdAt updatedAt"
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

// POST /api/public/quotes/:token/accept (ATOMIC)
router.post("/quotes/:token/accept", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ message: "Missing token" });

    const current = await Quote.findOne({ publicToken: token }).select("status publicTokenExpiresAt");
    if (!current) return res.status(404).json({ message: "Quote not found" });
    if (isTokenExpired(current)) return res.status(410).json({ message: "Quote link expired" });

    if (current.status === "accepted") {
      const q = await Quote.findOne({ publicToken: token });
      return res.json({ quote: q });
    }

    if (current.status !== "sent") {
      return res.status(409).json({ message: `Cannot accept a quote in status '${current.status}'` });
    }

    const now = new Date();
    const ip = clientIp(req);
    const ua = String(req.headers["user-agent"] || "").slice(0, 300);

    // ✅ identity payload (optional)
    const name = cleanStr(req.body?.name, 120);
    const email = cleanEmail(req.body?.email, 200);
    const note = cleanStr(req.body?.note, 500);

    const updated = await Quote.findOneAndUpdate(
      { publicToken: token, status: "sent" },
      {
        $set: {
          status: "accepted",
          acceptedAt: now,
          lockedAt: now,
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
      { new: true }
    );

    if (!updated) {
      const q = await Quote.findOne({ publicToken: token });
      return res.status(409).json({ message: "Quote status changed. Please refresh.", quote: q });
    }

    return res.json({ quote: updated });
  } catch (e) {
    console.error("public quote accept error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/public/quotes/:token/decline (ATOMIC)
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

    // ✅ identity payload (optional)
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