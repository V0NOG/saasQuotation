const mongoose = require("mongoose");

const OrgSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // SaaS tenant defaults
    currency: { type: String, default: "AUD" }, // can be changed per org
    taxRate: { type: Number, default: 0.10 },   // AU GST default

    // Branding for PDFs
    branding: {
      logoUrl: { type: String, default: "" },
      primaryColor: { type: String, default: "#1C2434" }, // TailAdmin-ish dark
      accentColor: { type: String, default: "#3C50E0" }
    },

    industry: { type: String, enum: ["plumber", "electrician", "both"], default: "both" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Org", OrgSchema);