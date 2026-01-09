// backend/routes/invoice.routes.js
const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const { requireActiveBilling } = require("../middleware/billing");

const Invoice = require("../models/Invoice");
const Org = require("../models/Org");

const { renderInvoicePdf, streamInvoicePdf } = require("../utils/invoicePdf");
const { sendInvoiceEmail } = require("../utils/mailer");

// Small helpers
function pickOrgName(org) {
  return (org && (org.name || org.orgName)) || "Quotify";
}

function makeInvoiceNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rnd = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `I-${y}${m}${day}-${rnd}`;
}

function safeInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

router.use(requireAuth, requireActiveBilling());

// LIST
router.get("/", async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const page = safeInt(req.query.page, 1);
    const limit = Math.min(safeInt(req.query.limit, 20), 100);
    const status = String(req.query.status || "").trim();
    const search = String(req.query.search || "").trim();

    const q = { orgId };

    if (status) q.status = status;

    if (search) {
      q.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { "customerSnapshot.name": { $regex: search, $options: "i" } },
        { "customerSnapshot.email": { $regex: search, $options: "i" } },
      ];
    }

    const total = await Invoice.countDocuments(q);
    const items = await Invoice.find(q)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e) {
    console.error("Invoice list error:", e);
    return res.status(500).json({ message: "Failed to load invoices." });
  }
});

// CREATE
router.post("/", async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const createdBy = req.user.id;

    const payload = req.body || {};

    const invoice = await Invoice.create({
      orgId,
      createdBy,

      invoiceNumber: payload.invoiceNumber || makeInvoiceNumber(),
      status: "draft",

      customerId: payload.customerId || null,
      customerSnapshot: payload.customerSnapshot || {},

      title: payload.title || "",
      notes: payload.notes || "",

      pricingMode: payload.pricingMode || "exclusive",
      lines: Array.isArray(payload.lines) ? payload.lines : [],

      subtotalExTax: Number(payload.subtotalExTax || 0),
      taxTotal: Number(payload.taxTotal || 0),
      totalIncTax: Number(payload.totalIncTax || 0),

      issueDate: payload.issueDate ? new Date(payload.issueDate) : new Date(),
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,

      quoteId: payload.quoteId || null,
      jobId: payload.jobId || null,

      statusHistory: [
        {
          from: "",
          to: "draft",
          actorType: "user",
          actorUserId: createdBy,
          meta: { note: "Invoice created" },
        },
      ],
    });

    return res.json({ invoice });
  } catch (e) {
    console.error("Invoice create error:", e);
    if (String(e?.message || "").includes("duplicate key")) {
      return res.status(409).json({ message: "Invoice number already exists." });
    }
    return res.status(500).json({ message: "Failed to create invoice." });
  }
});

// GET BY ID
router.get("/:id", async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const inv = await Invoice.findOne({ _id: req.params.id, orgId }).lean();
    if (!inv) return res.status(404).json({ message: "Invoice not found." });
    return res.json({ invoice: inv });
  } catch (e) {
    console.error("Invoice get error:", e);
    return res.status(500).json({ message: "Failed to load invoice." });
  }
});

// UPDATE
router.patch("/:id", async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const payload = req.body || {};

    const updated = await Invoice.findOneAndUpdate(
      { _id: req.params.id, orgId },
      {
        $set: {
          title: payload.title,
          notes: payload.notes,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : payload.dueDate === null ? null : undefined,

          // allow editing these for now
          pricingMode: payload.pricingMode,
          lines: Array.isArray(payload.lines) ? payload.lines : undefined,

          subtotalExTax: payload.subtotalExTax != null ? Number(payload.subtotalExTax) : undefined,
          taxTotal: payload.taxTotal != null ? Number(payload.taxTotal) : undefined,
          totalIncTax: payload.totalIncTax != null ? Number(payload.totalIncTax) : undefined,

          customerSnapshot: payload.customerSnapshot,
        },
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ message: "Invoice not found." });
    return res.json({ invoice: updated });
  } catch (e) {
    console.error("Invoice update error:", e);
    return res.status(500).json({ message: "Failed to update invoice." });
  }
});

// PDF (inline)
router.get("/:id/pdf", async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const invoice = await Invoice.findOne({ _id: req.params.id, orgId }).lean();
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });

    const org = await Org.findById(orgId).lean();
    return streamInvoicePdf(res, { invoice, org, disposition: "inline" });
  } catch (e) {
    console.error("Invoice pdf error:", e);
    return res.status(500).json({ message: "Failed to render invoice PDF." });
  }
});

// SEND (draft -> sent)
router.post("/:id/send", async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const actorUserId = req.user.id;

    const invoice = await Invoice.findOne({ _id: req.params.id, orgId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });

    if (invoice.status === "paid" || invoice.status === "void") {
      return res.status(400).json({ message: `Cannot send an invoice in status '${invoice.status}'.` });
    }

    const from = invoice.status || "draft";
    invoice.status = "sent";
    invoice.sentAt = new Date();

    invoice.statusHistory.push({
      from,
      to: "sent",
      actorType: "user",
      actorUserId,
      meta: { note: "Invoice sent" },
    });

    await invoice.save();
    return res.json({ invoice });
  } catch (e) {
    console.error("Invoice send error:", e);
    return res.status(500).json({ message: "Failed to send invoice." });
  }
});

// MARK PAID (manual for now)
router.post("/:id/mark-paid", async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const actorUserId = req.user.id;
    const note = String(req.body?.note || "").slice(0, 400);

    const invoice = await Invoice.findOne({ _id: req.params.id, orgId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });

    if (invoice.status === "void") {
      return res.status(400).json({ message: "Cannot mark a void invoice as paid." });
    }

    const from = invoice.status;
    invoice.status = "paid";
    invoice.paidAt = new Date();

    invoice.statusHistory.push({
      from,
      to: "paid",
      actorType: "user",
      actorUserId,
      meta: { note: note || "Marked paid" },
    });

    await invoice.save();
    return res.json({ invoice });
  } catch (e) {
    console.error("Invoice mark-paid error:", e);
    return res.status(500).json({ message: "Failed to mark invoice paid." });
  }
});

// EMAIL (idempotent like quotes)
router.post("/:id/email", async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const actorUserId = req.user.id;

    const idempotencyKey = String(req.headers["idempotency-key"] || "").trim();
    if (!idempotencyKey) return res.status(400).json({ message: "Missing Idempotency-Key header." });

    const invoice = await Invoice.findOne({ _id: req.params.id, orgId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });

    const to = String(req.body?.to || invoice.customerSnapshot?.email || "").trim();
    if (!to) return res.status(400).json({ message: "Missing recipient email." });

    // idempotency check
    const existing = (invoice.emailHistory || []).find((h) => h.key === idempotencyKey);
    if (existing) {
      return res.json({ ok: true, duplicate: true, messageId: existing.messageId || "" });
    }

    const org = await Org.findById(orgId).lean();
    const orgName = pickOrgName(org);

    const subject = String(req.body?.subject || `Invoice ${invoice.invoiceNumber} from ${orgName}`).trim();
    const attachPdf = req.body?.attachPdf !== false;

    let attachments = [];
    if (attachPdf) {
      const pdf = await renderInvoicePdf({ invoice: invoice.toObject(), org });
      attachments = [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ];
    }

    const text =
      String(req.body?.message || "").trim() ||
      `Hi ${invoice.customerSnapshot?.name || ""},\n\nPlease find your invoice attached.\n\nInvoice: ${invoice.invoiceNumber}\nTotal: ${invoice.totalIncTax?.toFixed?.(2) || invoice.totalIncTax}\n\nThanks,\n${orgName}\n`;

    const info = await sendInvoiceEmail({ to, subject, text, attachments });

    invoice.emailHistory.push({
      key: idempotencyKey,
      to,
      subject,
      pdfAttached: attachPdf,
      sentAt: new Date(),
      actorUserId,
      messageId: info?.messageId || "",
    });

    await invoice.save();

    return res.json({ ok: true, messageId: info?.messageId || "" });
  } catch (e) {
    console.error("Invoice email error:", e);
    return res.status(500).json({ message: "Failed to email invoice." });
  }
});

module.exports = router;