// backend/utils/quotePdf.js
const PDFDocument = require("pdfkit");

function safeDate(d) {
  const dt = d ? new Date(d) : null;
  if (!dt || Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatDate(d) {
  const dt = safeDate(d);
  return dt ? dt.toLocaleString() : "—";
}

function money(n) {
  return Number(n || 0).toFixed(2);
}

function getPublicUrl(quote) {
  if (!quote?.publicToken) return null;
  const base = String(process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || "").replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/quote/view/${quote.publicToken}`;
}

/**
 * Return a Buffer containing a PDF for a quote.
 * @param {{ quote:any, org:any }} args
 * @returns {Promise<Buffer>}
 */
async function renderQuotePdf({ quote, org }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 48 });

      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      writeQuotePdf(doc, { quote, org });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Stream a quote PDF to an Express response.
 * @param {import("express").Response} res
 * @param {{ quote:any, org:any, disposition?: "inline" | "attachment" }} args
 */
function streamQuotePdf(res, { quote, org, disposition = "inline" }) {
  const doc = new PDFDocument({ size: "A4", margin: 48 });

  const filename = `${quote.quoteNumber}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);

  doc.on("error", (err) => {
    try {
      if (!res.headersSent) res.status(500);
      res.end();
    } catch (_) {}
    console.error("PDF stream error:", err);
  });

  doc.pipe(res);

  writeQuotePdf(doc, { quote, org });

  doc.end();
}

/**
 * Shared PDF writer.
 * @param {PDFKit.PDFDocument} doc
 * @param {{ quote:any, org:any }} args
 */
function writeQuotePdf(doc, { quote, org }) {
  const orgName = (org && (org.name || org.orgName)) || "Quotify";
  const publicUrl = getPublicUrl(quote);

  // Header
  doc.fontSize(18).fillColor("#111111").text(orgName, { align: "left" }).moveDown(0.25);

  // Meta block
  doc
    .fontSize(12)
    .fillColor("#333333")
    .text(`Quote: ${quote.quoteNumber}`)
    .text(`Status: ${quote.status}`)
    .text(`Issued: ${formatDate(quote.issueDate)}`);

  if (safeDate(quote.validUntil)) {
    doc.text(`Valid until: ${formatDate(quote.validUntil)}`);
  }

  if (quote.status === "sent" && safeDate(quote.sentAt)) {
    doc.text(`Sent: ${formatDate(quote.sentAt)}`);
  }
  if (quote.status === "accepted" && safeDate(quote.acceptedAt)) {
    doc.text(`Accepted: ${formatDate(quote.acceptedAt)}`);
  }
  if (quote.status === "declined" && safeDate(quote.declinedAt)) {
    doc.text(`Declined: ${formatDate(quote.declinedAt)}`);
  }

  doc.moveDown(0.75);

  // ✅ Action section (conversion driver)
  if (publicUrl) {
    doc.fontSize(12).fillColor("#111111").text("Action", { underline: true }).moveDown(0.25);

    if (quote.status === "sent") {
      doc
        .fontSize(11)
        .fillColor("#333333")
        .text("To accept or decline this quote, use the link below:")
        .moveDown(0.15);
      doc.fontSize(11).fillColor("#0B63F6").text(publicUrl, { link: publicUrl, underline: true });
      doc.moveDown(0.5);

      doc
        .fontSize(9)
        .fillColor("#555555")
        .text("If the link has expired, contact the business and request a new quote link.");
      doc.moveDown(0.75);
    } else {
      // accepted / declined / draft (rare) — still show link if present for transparency
      doc
        .fontSize(11)
        .fillColor("#333333")
        .text("Quote link:")
        .moveDown(0.15);
      doc.fontSize(11).fillColor("#0B63F6").text(publicUrl, { link: publicUrl, underline: true });
      doc.moveDown(0.75);
    }
  }

  // Customer
  doc.fontSize(12).fillColor("#111111").text("Customer", { underline: true }).moveDown(0.25);

  const cs = quote.customerSnapshot || {};
  doc
    .fontSize(11)
    .fillColor("#333333")
    .text(cs.name || "—")
    .text(cs.email || "")
    .text(cs.phone || "")
    .text(cs.address || "")
    .moveDown(1);

  // Title / Notes
  if (quote.title) {
    doc.fontSize(12).fillColor("#111111").text("Title", { underline: true });
    doc.fontSize(11).fillColor("#333333").text(String(quote.title)).moveDown(0.75);
  }

  if (quote.notes) {
    doc.fontSize(12).fillColor("#111111").text("Notes", { underline: true });
    doc.fontSize(11).fillColor("#333333").text(String(quote.notes)).moveDown(0.75);
  }

  // Line items
  doc.fontSize(12).fillColor("#111111").text("Line items", { underline: true }).moveDown(0.5);

  const lines = Array.isArray(quote.lines) ? quote.lines : [];
  if (lines.length === 0) {
    doc.fontSize(11).fillColor("#333333").text("No line items.");
  } else {
    lines.forEach((l, idx) => {
      const qty = Number(l.quantity || 0);
      const name = String(l.name || "Item");

      const exStored = l.lineSubtotalExTax;
      const taxStored = l.lineTax;
      const incStored = l.lineTotalIncTax;

      const ex = Number(exStored != null ? exStored : qty * Number(l.unitPriceExTax || 0));
      const tax = Number(taxStored != null ? taxStored : 0);
      const inc = Number(incStored != null ? incStored : ex + tax);

      doc.fontSize(11).fillColor("#111111").text(`${idx + 1}. ${name}`);

      const desc = String(l.description || "");
      if (desc) doc.fontSize(10).fillColor("#555555").text(desc);

      doc
        .fontSize(10)
        .fillColor("#333333")
        .text(`Qty: ${qty}   Unit: ${l.unit || ""}`)
        .text(`Ex GST: ${money(ex)}   GST: ${money(tax)}   Inc GST: ${money(inc)}`)
        .moveDown(0.75);
    });
  }

  // Totals
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor("#111111").text("Totals", { underline: true }).moveDown(0.25);

  doc
    .fontSize(11)
    .fillColor("#333333")
    .text(`Subtotal (ex GST): ${money(quote.subtotalExTax)}`)
    .text(`GST: ${money(quote.taxTotal)}`)
    .fontSize(12)
    .fillColor("#111111")
    .text(`Total (inc GST): ${money(quote.totalIncTax)}`);

  // Footer disclaimer (minimal, useful)
  doc.moveDown(1.5);
  doc
    .fontSize(9)
    .fillColor("#777777")
    .text(
      "This quote is provided for the services/materials described above. Prices include applicable GST unless stated otherwise. Acceptance locks the quote and records an audit trail.",
      { align: "center" }
    )
    .moveDown(0.5);

  doc.fontSize(9).fillColor("#777777").text("Generated by Quotify", { align: "center" });
}

module.exports = { renderQuotePdf, streamQuotePdf };