const mongoose = require("mongoose");

const OrgSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // SaaS tenant defaults
    currency: { type: String, default: "AUD" }, // can be changed per org
    taxRate: { type: Number, default: 0.10 }, // AU GST default

    // Branding for PDFs
    branding: {
      logoUrl: { type: String, default: "" },
      primaryColor: { type: String, default: "#1C2434" }, // TailAdmin-ish dark
      accentColor: { type: String, default: "#3C50E0" },
    },

    industry: { type: String, enum: ["plumber", "electrician", "both"], default: "both" },

    // ✅ Billing (Option B foundation)
    billing: {
      plan: { type: String, enum: ["free", "starter", "pro", "enterprise"], default: "free" },
      status: {
        type: String,
        enum: ["trialing", "active", "past_due", "canceled", "free"],
        default: "trialing",
      },
      trialEndsAt: { type: Date, default: null },

      // placeholders for Stripe later (don’t use yet)
      stripeCustomerId: { type: String, default: "" },
      stripeSubscriptionId: { type: String, default: "" },
      currentPeriodEnd: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// ✅ Backfill helper idea (optional):
// - Existing orgs will get billing defaults automatically via schema defaults
module.exports = mongoose.model("Org", OrgSchema);