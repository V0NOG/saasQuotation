// backend/models/Invoice.js
const mongoose = require("mongoose");

const InvoiceEmailHistorySchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // idempotency key
    to: { type: String, required: true },
    subject: { type: String, default: "" },
    pdfAttached: { type: Boolean, default: true },
    sentAt: { type: Date, default: Date.now, required: true },

    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    messageId: { type: String, default: "" },
  },
  { _id: false }
);

const InvoiceLineSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "PriceItem", default: null },
    type: { type: String, enum: ["service", "material"], required: true },

    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    quantity: { type: Number, required: true, default: 1 },
    unit: { type: String, default: "" },

    unitPriceExTax: { type: Number, required: true },
    taxRate: { type: Number, default: null },

    minutes: { type: Number, default: null },

    lineSubtotalExTax: { type: Number, required: true, default: 0 },
    lineTax: { type: Number, required: true, default: 0 },
    lineTotalIncTax: { type: Number, required: true, default: 0 },
  },
  { _id: true }
);

const InvoiceStatusHistorySchema = new mongoose.Schema(
  {
    from: { type: String, enum: ["draft", "sent", "paid", "overdue", "void"], required: true },
    to: { type: String, enum: ["draft", "sent", "paid", "overdue", "void"], required: true },
    at: { type: Date, default: Date.now, required: true },

    actorType: { type: String, enum: ["user", "system"], required: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    meta: {
      note: { type: String, default: "" },
    },
  },
  { _id: false }
);

const InvoiceSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Org", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    invoiceNumber: { type: String, required: true, index: true },
    status: { type: String, enum: ["draft", "sent", "paid", "overdue", "void"], default: "draft", index: true },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    customerSnapshot: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
    },

    title: { type: String, default: "" },
    notes: { type: String, default: "" },

    pricingMode: { type: String, enum: ["exclusive", "inclusive"], default: "exclusive" },

    lines: { type: [InvoiceLineSchema], default: [] },

    subtotalExTax: { type: Number, required: true, default: 0 },
    taxTotal: { type: Number, required: true, default: 0 },
    totalIncTax: { type: Number, required: true, default: 0 },

    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null },

    sentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    voidAt: { type: Date, default: null },

    // Links (optional)
    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", default: null },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },

    statusHistory: { type: [InvoiceStatusHistorySchema], default: [] },
    emailHistory: { type: [InvoiceEmailHistorySchema], default: [] },
  },
  { timestamps: true }
);

InvoiceSchema.index({ orgId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ _id: 1, "emailHistory.key": 1 });

module.exports = mongoose.model("Invoice", InvoiceSchema);