// backend/models/Quote.js
const mongoose = require("mongoose");

const QuoteEmailHistorySchema = new mongoose.Schema(
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

const QuoteLineSchema = new mongoose.Schema(
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

const QuoteStatusHistorySchema = new mongoose.Schema(
  {
    from: { type: String, enum: ["draft", "sent", "accepted", "declined"], required: true },
    to: { type: String, enum: ["draft", "sent", "accepted", "declined"], required: true },
    at: { type: Date, default: Date.now, required: true },

    actorType: { type: String, enum: ["user", "public", "system"], required: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // ✅ expanded metadata for public actions
    meta: {
      ip: { type: String, default: "" },
      userAgent: { type: String, default: "" },

      // ✅ new fields (public acceptance identity)
      name: { type: String, default: "" },
      email: { type: String, default: "" },

      note: { type: String, default: "" },
    },
  },
  { _id: false }
);

const QuoteSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Org", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    quoteNumber: { type: String, required: true, index: true },
    status: { type: String, enum: ["draft", "sent", "accepted", "declined"], default: "draft", index: true },

    publicToken: { type: String, default: null },
    publicTokenCreatedAt: { type: Date, default: null },
    publicTokenExpiresAt: { type: Date, default: null },

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

    lines: { type: [QuoteLineSchema], default: [] },

    subtotalExTax: { type: Number, required: true, default: 0 },
    taxTotal: { type: Number, required: true, default: 0 },
    totalIncTax: { type: Number, required: true, default: 0 },

    issueDate: { type: Date, default: Date.now },
    validUntil: { type: Date, default: null },

    sentAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },

    lockedAt: { type: Date, default: null },

    // Link to generated job (created on acceptance)
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },

    statusHistory: { type: [QuoteStatusHistorySchema], default: [] },

    emailHistory: { type: [QuoteEmailHistorySchema], default: [] },
  },
  { timestamps: true }
);

QuoteSchema.index({ orgId: 1, quoteNumber: 1 }, { unique: true });
QuoteSchema.index({ publicToken: 1 }, { unique: true, sparse: true });
QuoteSchema.index({ _id: 1, "emailHistory.key": 1 });

module.exports = mongoose.model("Quote", QuoteSchema);