// backend/routes/publicQuote.routes.js
const express = require("express");
const Quote = require("../models/Quote");
const Org = require("../models/Org");
const { renderQuotePdf } = require("../utils/quotePdf");

const router = express.Router();

function isTokenExpired(q) {
  return q.publicTokenExpiresAt && new Date(q.publicTokenExpiresAt).getTime() <= Date.now();
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.ip || "";
}

// GET /api/public/quotes/:token
router.get("/quotes/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ message: "Missing token" });

    const quote = await Quote.findOne({ publicToken: token }).select(
      "_id quoteNumber status title notes pricingMode customerSnapshot lines subtotalExTax taxTotal totalIncTax issueDate validUntil sentAt acceptedAt declinedAt publicTokenExpiresAt lockedAt createdAt updatedAt orgId"
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

    const org = quote.orgId
      ? await Org.findById(quote.orgId).select("name orgName")
      : null;

    const pdfBuffer = await renderQuotePdf({ quote, org });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${quote.quoteNumber}.pdf"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));

    return res.status(200).send(pdfBuffer);
  } catch (e) {
    console.error("public quote pdf error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/public/quotes/:token/accept
router.post("/quotes/:token/accept", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ message: "Missing token" });

    const quote = await Quote.findOne({ publicToken: token });
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    if (isTokenExpired(quote)) return res.status(410).json({ message: "Quote link expired" });

    if (quote.status === "accepted") return res.json({ quote });

    if (quote.status !== "sent") {
      return res.status(409).json({ message: `Cannot accept a quote in status '${quote.status}'` });
    }

    const now = new Date();
    const ip = clientIp(req);
    const ua = String(req.headers["user-agent"] || "");

    quote.statusHistory.push({
      from: quote.status,
      to: "accepted",
      at: now,
      actorType: "public",
      actorUserId: null,
      meta: { ip, userAgent: ua, note: "" },
    });

    quote.status = "accepted";
    quote.acceptedAt = now;
    quote.lockedAt = now;

    await quote.save();
    return res.json({ quote });
  } catch (e) {
    console.error("public quote accept error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/public/quotes/:token/decline
router.post("/quotes/:token/decline", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ message: "Missing token" });

    const quote = await Quote.findOne({ publicToken: token });
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    if (isTokenExpired(quote)) return res.status(410).json({ message: "Quote link expired" });

    if (quote.status === "declined") return res.json({ quote });

    if (quote.status !== "sent") {
      return res.status(409).json({ message: `Cannot decline a quote in status '${quote.status}'` });
    }

    const now = new Date();
    const ip = clientIp(req);
    const ua = String(req.headers["user-agent"] || "");

    quote.statusHistory.push({
      from: quote.status,
      to: "declined",
      at: now,
      actorType: "public",
      actorUserId: null,
      meta: { ip, userAgent: ua, note: "" },
    });

    quote.status = "declined";
    quote.declinedAt = now;

    await quote.save();
    return res.json({ quote });
  } catch (e) {
    console.error("public quote decline error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;