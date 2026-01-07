// backend/models/PriceItem.js
const mongoose = require("mongoose");

const PriceItemSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Org", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    type: { type: String, enum: ["service", "material"], required: true, index: true },

    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // Pricing
    unitPrice: { type: Number, required: true }, // ex GST by default (you can decide later)
    taxRate: { type: Number, default: null },    // null => use org.taxRate later in quotes

    // Optional but useful for services
    defaultMinutes: { type: Number, default: null }, // e.g. 30 mins labour

    // Optional for materials (stock keeping later)
    unit: { type: String, default: "" }, // e.g. "each", "m", "box"

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PriceItemSchema.index({ orgId: 1, type: 1, name: 1 });

module.exports = mongoose.model("PriceItem", PriceItemSchema);