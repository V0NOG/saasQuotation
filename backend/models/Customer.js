// backend/models/Customer.js
const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Org", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true },

    address: {
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      suburb: { type: String, default: "" },
      state: { type: String, default: "" },
      postcode: { type: String, default: "" },
      country: { type: String, default: "Australia" },
    },

    notes: { type: String, default: "" },

    // Optional: handy later for searching/filtering
    tags: [{ type: String }],
  },
  { timestamps: true }
);

// Helpful indexes
CustomerSchema.index({ orgId: 1, name: 1 });
CustomerSchema.index({ orgId: 1, email: 1 });
CustomerSchema.index({ orgId: 1, phone: 1 });

module.exports = mongoose.model("Customer", CustomerSchema);
