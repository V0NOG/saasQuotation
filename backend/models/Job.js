// backend/models/Job.js
const mongoose = require("mongoose");

const JobStatusHistorySchema = new mongoose.Schema(
  {
    from: { type: String, default: "" },
    to: { type: String, required: true },
    at: { type: Date, default: Date.now, required: true },

    actorType: { type: String, enum: ["user", "system"], required: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    meta: {
      note: { type: String, default: "" },
    },
  },
  { _id: false }
);

const JobSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Org", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Link to source quote
    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", required: true, index: true },

    jobNumber: { type: String, required: true, index: true }, // e.g. J-20260109-AB12
    status: {
      type: String,
      enum: ["created", "scheduled", "in_progress", "completed", "canceled"],
      default: "created",
      index: true,
    },

    // Snapshot customer for safety
    customerSnapshot: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
    },

    title: { type: String, default: "" },
    notes: { type: String, default: "" },

    // Scheduling (optional now, used later)
    scheduledStart: { type: Date, default: null },
    scheduledEnd: { type: Date, default: null },

    // Copy of quote line items + totals at acceptance time
    lines: { type: Array, default: [] },
    subtotalExTax: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    totalIncTax: { type: Number, default: 0 },

    statusHistory: { type: [JobStatusHistorySchema], default: [] },
  },
  { timestamps: true }
);

// Prevent duplicate jobs for same quote
JobSchema.index({ quoteId: 1 }, { unique: true });

// Also keep jobNumber unique per org
JobSchema.index({ orgId: 1, jobNumber: 1 }, { unique: true });

module.exports = mongoose.model("Job", JobSchema);