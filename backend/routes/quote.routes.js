// backend/routes/quote.routes.js
const express = require("express");
const mongoose = require("mongoose");
const Quote = require("../models/Quote");
const Org = require("../models/Org");
const Customer = require("../models/Customer");
const { requireAuth } = require("../middleware/auth");
const { computeQuoteTotals } = require("../utils/quoteMath");
const { generatePublicToken } = require("../utils/tokens");
const { streamQuotePdf, renderQuotePdf } = require("../utils/quotePdf");
const { sendQuoteEmail } = require("../utils/mailer");
const { requireActiveBilling } = require("../middleware/billing");

const router = express.Router();

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function requireValidObjectId(id) {
  return mongoose.isValidObjectId(id);
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

// GET /api/quotes
router.get("/", requireAuth, requireActiveBilling("starter"), async (req, res) => {
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
      filter.$or = [{ quoteNumber: rx }, { title: rx }, { "customerSnapshot.name": rx }, { "customerSnapshot.email": rx }];
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

    return res.json({ items, page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) });
  } catch (e) {
    console.error("quotes list error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/quotes/:id
router.get("/:id", requireAuth, requireActiveBilling("starter"), async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid quote id" });

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
router.get("/:id/pdf", requireAuth, requireActiveBilling("starter"), async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid quote id" });

    const orgId = req.user.orgId;
    const quote = await Quote.findOne({ _id: req.params.id, orgId });
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    const org = await Org.findById(orgId).select("name orgName");
    return streamQuotePdf(res, { quote, org, disposition: "inline" });
  } catch (e) {
    console.error("quote pdf error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/quotes
router.post("/", requireAuth, requireActiveBilling("starter"), async (req, res) => {
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

    const { computedLines, subtotalExTax, taxTotal, totalIncTax } = computeQuoteTotals({ lines, orgTaxRate });

    let quoteNumber = generateQuoteNumber();
    for (let i = 0; i < 3; i++) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await Quote.findOne({ orgId, quoteNumber }).select("_id");
      if (!exists) break;
      quoteNumber = generateQuoteNumber();
    }

    let finalCustomerSnapshot = { name: "", email: "", phone: "", address: "" };

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
        finalCustomerSnapshot = { name: c.name || "", email: c.email || "", phone: c.phone || "", address };
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
    });

    return res.status(201).json({ quote: created });
  } catch (e) {
    console.error("quotes create error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/quotes/:id/send (auth, org-scoped, idempotent-ish)
router.post("/:id/send", requireAuth, requireActiveBilling("starter"), async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid quote id" });

    const orgId = req.user.orgId;
    const userId = req.user.id;

    const quote = await Quote.findOne({ _id: req.params.id, orgId });
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    if (quote.status === "accepted") return res.status(409).json({ message: "Quote has been accepted and is locked" });
    if (quote.status === "declined") return res.status(409).json({ message: "Quote has been declined" });

    const now = new Date();

    if (!quote.publicToken) {
      quote.publicToken = generatePublicToken();
      quote.publicTokenCreatedAt = now;

      if (quote.validUntil instanceof Date && !Number.isNaN(quote.validUntil.getTime())) {
        quote.publicTokenExpiresAt = quote.validUntil;
      }
    }

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
    if (e && e.code === 11000 && String(e.message || "").includes("publicToken")) {
      return res.status(503).json({ message: "Token collision, please retry" });
    }
    console.error("quotes send error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/quotes/:id/email
// body: { to?: string, message?: string, attachPdf?: boolean }
// Idempotency via header: Idempotency-Key
router.post("/:id/email", requireAuth, requireActiveBilling("starter"), async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid quote id" });

    const orgId = req.user.orgId;
    const userId = req.user.id;

    const quote = await Quote.findOne({ _id: req.params.id, orgId });
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    // hard stops
    if (quote.status === "accepted" || quote.lockedAt) {
      return res.status(409).json({ message: "Quote has been accepted and is locked" });
    }
    if (quote.status === "declined") {
      return res.status(409).json({ message: "Quote has been declined" });
    }

    const to = String(req.body?.to || quote.customerSnapshot?.email || "").trim();
    if (!to) return res.status(400).json({ message: "Customer email is missing" });

    const idemKey = String(req.headers["idempotency-key"] || "").trim();
    if (!idemKey) return res.status(400).json({ message: "Missing Idempotency-Key header" });

    // fast idempotency check (cheap)
    const already = (quote.emailHistory || []).find((h) => h && h.key === idemKey);
    if (already) {
      return res.json({ ok: true, duplicate: true, messageId: already.messageId || "" });
    }

    // ✅ Ensure quote is "sent" and has a publicToken BEFORE emailing.
    // This makes email robust even if UI forgets to call /send first.
    const now = new Date();

    // Token generation can theoretically collide, so retry a few times.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (!quote.publicToken) {
          quote.publicToken = generatePublicToken();
          quote.publicTokenCreatedAt = now;

          if (quote.validUntil instanceof Date && !Number.isNaN(quote.validUntil.getTime())) {
            quote.publicTokenExpiresAt = quote.validUntil;
          }
        }

        if (quote.status !== "sent") {
          quote.statusHistory.push({
            from: quote.status,
            to: "sent",
            at: now,
            actorType: "user",
            actorUserId: userId,
            meta: { ip: "", userAgent: "", note: "Auto-sent during email" },
          });

          quote.status = "sent";
          quote.sentAt = now;
        }

        // persist "sent" state + token
        await quote.save();
        break;
      } catch (e) {
        // retry only on publicToken collision
        if (e && e.code === 11000 && String(e.message || "").includes("publicToken")) {
          quote.publicToken = null;
          quote.publicTokenCreatedAt = null;
          quote.publicTokenExpiresAt = null;
          if (attempt === 2) {
            return res.status(503).json({ message: "Token collision, please retry" });
          }
          continue;
        }
        throw e;
      }
    }

    const appUrl = String(process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || "").replace(/\/+$/, "");
    const publicUrl = `${appUrl}/quote/view/${quote.publicToken}`;

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
      const org = await Org.findById(orgId).select("name orgName");
      const pdfBuffer = await renderQuotePdf({ quote, org });
      attachments.push({ filename: `${quote.quoteNumber}.pdf`, content: pdfBuffer });
    }

    const info = await sendQuoteEmail({ to, subject, text, html, attachments });

    const rawMessageId = String(info?.messageId || "");
    const safeMessageId = rawMessageId.replace(/[\r\n]/g, "").slice(0, 200);

    const historyEntry = {
      key: idemKey,
      to,
      subject,
      pdfAttached: !!attachPdf,
      sentAt: new Date(),
      actorUserId: userId,
      messageId: safeMessageId,
    };

    // ✅ ATOMIC idempotency enforcement:
    const updated = await Quote.findOneAndUpdate(
      { _id: quote._id, orgId, "emailHistory.key": { $ne: idemKey } },
      { $push: { emailHistory: historyEntry } },
      { new: true }
    );

    if (!updated) {
      // Another request with same key won the race
      return res.json({ ok: true, duplicate: true, messageId: safeMessageId });
    }

    return res.json({ ok: true, messageId: safeMessageId });
  } catch (e) {
    console.error("quote email error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/quotes/:id
router.patch("/:id", requireAuth, requireActiveBilling("starter"), async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid quote id" });

    const orgId = req.user.orgId;
    const quote = await Quote.findOne({ _id: req.params.id, orgId });
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    if (isLocked(quote)) return res.status(409).json({ message: "Quote is locked and cannot be edited" });

    const org = await Org.findById(orgId).select("taxRate");
    const orgTaxRate = org?.taxRate ?? 0.1;

    const updates = req.body || {};
    const allowed = {};

    if (typeof updates.title === "string") allowed.title = updates.title;
    if (typeof updates.notes === "string") allowed.notes = updates.notes;
    if (updates.pricingMode === "exclusive" || updates.pricingMode === "inclusive") allowed.pricingMode = updates.pricingMode;

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
      const { computedLines, subtotalExTax, taxTotal, totalIncTax } = computeQuoteTotals({ lines: updates.lines, orgTaxRate });
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
router.delete("/:id", requireAuth, requireActiveBilling("starter"), async (req, res) => {
  try {
    if (!requireValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid quote id" });

    const orgId = req.user.orgId;

    // Optional: keep delete allowed even if accepted, but most SaaS prevents it.
    // If you want strictness, uncomment:
    // const q = await Quote.findOne({ _id: req.params.id, orgId }).select("status lockedAt");
    // if (!q) return res.status(404).json({ message: "Quote not found" });
    // if (isLocked(q)) return res.status(409).json({ message: "Quote is locked and cannot be deleted" });

    const deleted = await Quote.findOneAndDelete({ _id: req.params.id, orgId });
    if (!deleted) return res.status(404).json({ message: "Quote not found" });

    return res.json({ ok: true });
  } catch (e) {
    console.error("quotes delete error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;