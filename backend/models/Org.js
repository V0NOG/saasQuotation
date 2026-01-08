// backend/models/Org.js
const mongoose = require("mongoose");

const OrgSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    currency: { type: String, default: "AUD" },
    taxRate: { type: Number, default: 0.10 },

    branding: {
      logoUrl: { type: String, default: "" },
      primaryColor: { type: String, default: "#1C2434" },
      accentColor: { type: String, default: "#3C50E0" },
    },

    industry: { type: String, enum: ["plumber", "electrician", "both"], default: "both" },

    // backend/models/Org.js  (replace billing: { ... } defaults)
    billing: {
      plan: { type: String, enum: ["free", "starter", "pro", "enterprise"], default: "free" },
      status: {
        type: String,
        enum: ["trialing", "active", "past_due", "canceled", "free"],
        default: "free",
      },
      trialEndsAt: { type: Date, default: null },

      stripeCustomerId: { type: String, default: "" },
      stripeSubscriptionId: { type: String, default: "" },
      currentPeriodEnd: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Org", OrgSchema);