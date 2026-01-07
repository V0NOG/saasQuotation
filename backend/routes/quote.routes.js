// backend/routes/quote.routes.js
const express = require("express");
const Quote = require("../models/Quote");
const Org = require("../models/Org");
const { requireAuth } = require("../middleware/auth");
const { computeQuoteTotals } = require("../utils/quoteMath");
const Customer = require("../models/Customer");
const { generatePublicToken } = require("../utils/tokens");
const { renderQuotePdf } = require("../utils/quotePdf");
const { sendQuoteEmail } = require("../utils/mailer");

const mongoose = require("mongoose");

const router = express.Router();

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generateQuoteNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `Q-${y}${m}${day}-${rand}`;
}

function isLocked(quote) {
  return quote.status === "accepted" || !!quote.lockedAt;
}

function requireValidObjectId(id) {
  return mongoose.isValidObjectId(id);
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
        .select(
          "_id quoteNumber status title customerSnapshot pricingMode subtotalExTax taxTotal totalIncTax createdAt sentAt acceptedAt declinedAt publicToken"
        )
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
    if (!requireValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid quote id" });
    }
    const orgId = req.user.orgId;
    const quote = await Quote.findOne({ _id: req.params.id, orgId });
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    return res.json({ quote });
  } catch (e) {
    console.error("quotes read error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/quotes/:id/pdf
router.get("/:id/pdf", requireAuth, async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid quote id" });
    }

    const orgId = req.user.orgId;
    const quote = await Quote.findOne({ _id: req.params.id, orgId });
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    // Optional: include org branding later (logo, address, etc.)
    return renderQuotePdf(res, quote, null);
  } catch (e) {
    console.error("quote pdf error:", e);
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
      customerSnapshot = null,
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

    let quoteNumber = generateQuoteNumber();
    for (let i = 0; i < 3; i++) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await Quote.findOne({ orgId, quoteNumber }).select("_id");
      if (!exists) break;
      quoteNumber = generateQuoteNumber();
    }

    let finalCustomerSnapshot = {
      name: "",
      email: "",
      phone: "",
      address: "",
    };

    if (customerSnapshot && typeof customerSnapshot === "object") {
      finalCustomerSnapshot = {
        name: String(customerSnapshot?.name || ""),
        email: String(customerSnapshot?.email || ""),
        phone: String(customerSnapshot?.phone || ""),
        address: String(customerSnapshot?.address || ""),
      };
    } else if (customerId) {
      const c = await Customer.findOne({ _id: customerId, orgId }).select("name email phone address");
      if (c) {
        const a = c.address || {};
        const address = [a.line1, a.line2, a.suburb, a.state, a.postcode, a.country].filter(Boolean).join(", ");
        finalCustomerSnapshot = {
          name: c.name || "",
          email: c.email || "",
          phone: c.phone || "",
          address,
        };
      }
    }

    const created = await Quote.create({
      orgId,
      createdBy: req.user.id,
      quoteNumber,
      status: safeStatus,

      customerId: customerId || null,
      customerSnapshot: finalCustomerSnapshot,

      title: String(title || ""),
      notes: String(notes || ""),

      pricingMode: safePricingMode,
      lines: computedLines,

      subtotalExTax,
      taxTotal,
      totalIncTax,

      issueDate: issueDate ? new Date(issueDate) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,

      // lifecycle fields default null; statusHistory default []
    });

    return res.status(201).json({ quote: created });
  } catch (e) {
    console.error("quotes create error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/quotes/:id/send  (auth, org-scoped, idempotent)
router.post("/:id/send", requireAuth, async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid quote id" });
    }
    const orgId = req.user.orgId;
    const userId = req.user.id;

    const quote = await Quote.findOne({ _id: req.params.id, orgId });
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    // If already accepted/declined, we won't move it back to sent.
    if (quote.status === "accepted") {
      return res.status(409).json({ message: "Quote has been accepted and is locked" });
    }
    if (quote.status === "declined") {
      return res.status(409).json({ message: "Quote has been declined" });
    }

    const now = new Date();

    // Mint public token if missing (unguessable)
    if (!quote.publicToken) {
      // extremely unlikely collision; retry a few times if unique index conflicts on save
      quote.publicToken = generatePublicToken();
      quote.publicTokenCreatedAt = now;

      // Optional: set expiry based on validUntil if present (nice default)
      // If you'd rather not tie it, just leave it null.
      if (quote.validUntil instanceof Date && !Number.isNaN(quote.validUntil.getTime())) {
        quote.publicTokenExpiresAt = quote.validUntil;
      }
    }

    // Idempotency: if already sent, don't add duplicate history entries
    if (quote.status !== "sent") {
      quote.statusHistory.push({
        from: quote.status,
        to: "sent",
        at: now,
        actorType: "user",
        actorUserId: userId,
        meta: { ip: "", userAgent: "", note: "" },
      });

      quote.status = "sent";
      quote.sentAt = now;
    }

    await quote.save();
    return res.json({ quote });
  } catch (e) {
    // Handle rare unique token collision
    if (e && e.code === 11000 && String(e.message || "").includes("publicToken")) {
      return res.status(503).json({ message: "Token collision, please retry" });
    }
    console.error("quotes send error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/quotes/:id/email
// body: { to?: string, message?: string, attachPdf?: boolean }
router.post("/:id/email", requireAuth, async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid quote id" });
    }

    const orgId = req.user.orgId;
    const quote = await Quote.findOne({ _id: req.params.id, orgId });
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    const to =
      String(req.body?.to || quote.customerSnapshot?.email || "").trim();

    if (!to) {
      return res.status(400).json({ message: "Customer email is missing" });
    }

    if (!quote.publicToken) {
      return res.status(409).json({ message: "Quote must be sent before emailing (no public link yet)" });
    }

    const publicUrl = `${process.env.FRONTEND_URL}/quote/view/${quote.publicToken}`;
    const attachPdf = req.body?.attachPdf !== false; // default true
    const extraMessage = String(req.body?.message || "").trim();

    const subject = `Quote ${quote.quoteNumber}${quote.title ? ` - ${quote.title}` : ""}`;

    const text =
      `Hi${quote.customerSnapshot?.name ? ` ${quote.customerSnapshot.name}` : ""},\n\n` +
      `Your quote is ready.\n\n` +
      `View and accept here:\n${publicUrl}\n\n` +
      (extraMessage ? `${extraMessage}\n\n` : "") +
      `Thanks`;

    const html =
      `<p>Hi${quote.customerSnapshot?.name ? ` ${quote.customerSnapshot.name}` : ""},</p>` +
      `<p>Your quote is ready.</p>` +
      `<p><b>View and accept:</b><br/><a href="${publicUrl}">${publicUrl}</a></p>` +
      (extraMessage ? `<p>${extraMessage.replace(/\n/g, "<br/>")}</p>` : "") +
      `<p>Thanks</p>`;

    const attachments = [];

    if (attachPdf) {
      // Build PDF in-memory buffer (simple approach)
      const chunks = [];
      const streamRes = {
        setHeader() {},
        pipe() {},
      };

      // Create a doc separately so we can buffer
      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      doc.on("data", (d) => chunks.push(d));
      const pdfDone = new Promise((resolve) => doc.on("end", resolve));

      // Render minimal copy of renderQuotePdf (buffer version)
      // To keep this clean, we’ll reuse the same layout logic but in buffer mode:
      // easiest: call a dedicated buffer generator later. For now, create a basic PDF quickly.
      doc.fontSize(18).text(orgId ? "Quote" : "Quote").moveDown(0.5);
      doc.fontSize(12).text(`Quote #: ${quote.quoteNumber}`);
      doc.text(`Status: ${quote.status}`);
      doc.moveDown(0.5);
      doc.text(`Total (inc GST): $${Number(quote.totalIncTax || 0).toFixed(2)}`);
      doc.moveDown(0.5);
      doc.text(`Public link: ${publicUrl}`);
      doc.end();

      await pdfDone;
      const pdfBuffer = Buffer.concat(chunks);

      attachments.push({
        filename: `${quote.quoteNumber}.pdf`,
        content: pdfBuffer,
      });
    }

    await sendQuoteEmail({
      to,
      subject,
      text,
      html,
      attachments,
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("quote email error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/quotes/:id  (no status changes here; enforce lock)
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid quote id" });
    }

    const orgId = req.user.orgId;
    const quote = await Quote.findOne({ _id: req.params.id, orgId });
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    if (isLocked(quote)) {
      return res.status(409).json({ message: "Quote is locked and cannot be edited" });
    }

    const org = await Org.findById(orgId).select("taxRate");
    const orgTaxRate = org?.taxRate ?? 0.1;

    const updates = req.body || {};

    const allowed = {};
    if (typeof updates.title === "string") allowed.title = updates.title;
    if (typeof updates.notes === "string") allowed.notes = updates.notes;

    if (updates.pricingMode === "exclusive" || updates.pricingMode === "inclusive") {
      allowed.pricingMode = updates.pricingMode;
    }

    // IMPORTANT: status transitions are not allowed via PATCH anymore.
    // They must go through dedicated endpoints (send/accept/decline).

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

    Object.assign(quote, allowed);
    await quote.save();

    return res.json({ quote });
  } catch (e) {
    console.error("quotes patch error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/quotes/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid quote id" });
    }

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