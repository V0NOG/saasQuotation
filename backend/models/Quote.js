// backend/models/Quote.js
const mongoose = require("mongoose");

const QuoteLineSchema = new mongoose.Schema(
  {
    // Reference to original pricebook item (optional snapshot safety)
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "PriceItem", default: null },
    type: { type: String, enum: ["service", "material"], required: true },

    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    quantity: { type: Number, required: true, default: 1 },
    unit: { type: String, default: "" },

    // Stored as EX GST always (canonical)
    unitPriceExTax: { type: Number, required: true },
    taxRate: { type: Number, default: null }, // null => use org taxRate at time of calc

    // Optional for services
    minutes: { type: Number, default: null },

    // Calculated snapshots (stored so list view is fast)
    lineSubtotalExTax: { type: Number, required: true, default: 0 },
    lineTax: { type: Number, required: true, default: 0 },
    lineTotalIncTax: { type: Number, required: true, default: 0 },
  },
  { _id: true }
);

const QuoteSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Org", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    quoteNumber: { type: String, required: true, index: true }, // e.g. Q-20260107-AB12
    status: { type: String, enum: ["draft", "sent", "accepted", "declined"], default: "draft", index: true },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    customerSnapshot: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
    },

    title: { type: String, default: "" },
    notes: { type: String, default: "" },

    // Quote-level GST mode for DISPLAY
    // (we store canonical unitPriceExTax regardless)
    pricingMode: { type: String, enum: ["exclusive", "inclusive"], default: "exclusive" },

    lines: { type: [QuoteLineSchema], default: [] },

    // Totals (stored)
    subtotalExTax: { type: Number, required: true, default: 0 },
    taxTotal: { type: Number, required: true, default: 0 },
    totalIncTax: { type: Number, required: true, default: 0 },

    // Dates
    issueDate: { type: Date, default: Date.now },
    validUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

QuoteSchema.index({ orgId: 1, quoteNumber: 1 }, { unique: true });

module.exports = mongoose.model("Quote", QuoteSchema);