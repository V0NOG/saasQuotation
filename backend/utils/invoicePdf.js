// backend/utils/invoicePdf.js
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

/**
 * Return a Buffer containing a PDF for an invoice.
 * @param {{ invoice:any, org:any }} args
 * @returns {Promise<Buffer>}
 */
async function renderInvoicePdf({ invoice, org }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 48 });

      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      writeInvoicePdf(doc, { invoice, org });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Stream an invoice PDF to an Express response.
 * @param {import("express").Response} res
 * @param {{ invoice:any, org:any, disposition?: "inline" | "attachment" }} args
 */
function streamInvoicePdf(res, { invoice, org, disposition = "inline" }) {
  const doc = new PDFDocument({ size: "A4", margin: 48 });

  const filename = `${invoice.invoiceNumber}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);

  doc.on("error", (err) => {
    try {
      if (!res.headersSent) res.status(500);
      res.end();
    } catch (_) {}
    console.error("Invoice PDF stream error:", err);
  });

  doc.pipe(res);

  writeInvoicePdf(doc, { invoice, org });

  doc.end();
}

/**
 * Shared PDF writer.
 * @param {PDFKit.PDFDocument} doc
 * @param {{ invoice:any, org:any }} args
 */
function writeInvoicePdf(doc, { invoice, org }) {
  const orgName = (org && (org.name || org.orgName)) || "Quotify";

  // Header
  doc.fontSize(18).fillColor("#111111").text(orgName, { align: "left" }).moveDown(0.25);

  // Meta block
  doc
    .fontSize(12)
    .fillColor("#333333")
    .text(`Invoice: ${invoice.invoiceNumber}`)
    .text(`Status: ${invoice.status}`)
    .text(`Issued: ${formatDate(invoice.issueDate)}`);

  if (safeDate(invoice.dueDate)) doc.text(`Due: ${formatDate(invoice.dueDate)}`);
  if (invoice.status === "sent" && safeDate(invoice.sentAt)) doc.text(`Sent: ${formatDate(invoice.sentAt)}`);
  if (invoice.status === "paid" && safeDate(invoice.paidAt)) doc.text(`Paid: ${formatDate(invoice.paidAt)}`);
  if (invoice.status === "void" && safeDate(invoice.voidAt)) doc.text(`Voided: ${formatDate(invoice.voidAt)}`);

  doc.moveDown(0.75);

  // Customer
  doc.fontSize(12).fillColor("#111111").text("Customer", { underline: true }).moveDown(0.25);

  const cs = invoice.customerSnapshot || {};
  doc
    .fontSize(11)
    .fillColor("#333333")
    .text(cs.name || "—")
    .text(cs.email || "")
    .text(cs.phone || "")
    .text(cs.address || "")
    .moveDown(1);

  // Title / Notes
  if (invoice.title) {
    doc.fontSize(12).fillColor("#111111").text("Title", { underline: true });
    doc.fontSize(11).fillColor("#333333").text(String(invoice.title)).moveDown(0.75);
  }

  if (invoice.notes) {
    doc.fontSize(12).fillColor("#111111").text("Notes", { underline: true });
    doc.fontSize(11).fillColor("#333333").text(String(invoice.notes)).moveDown(0.75);
  }

  // Line items
  doc.fontSize(12).fillColor("#111111").text("Line items", { underline: true }).moveDown(0.5);

  const lines = Array.isArray(invoice.lines) ? invoice.lines : [];
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
    .text(`Subtotal (ex GST): ${money(invoice.subtotalExTax)}`)
    .text(`GST: ${money(invoice.taxTotal)}`)
    .fontSize(12)
    .fillColor("#111111")
    .text(`Total (inc GST): ${money(invoice.totalIncTax)}`);

  // Footer disclaimer
  doc.moveDown(1.5);
  doc
    .fontSize(9)
    .fillColor("#777777")
    .text(
      "This invoice relates to the services/materials described above. Please contact the business if anything looks incorrect.",
      { align: "center" }
    )
    .moveDown(0.5);

  doc.fontSize(9).fillColor("#777777").text("Generated by Quotify", { align: "center" });
}

module.exports = { renderInvoicePdf, streamInvoicePdf };