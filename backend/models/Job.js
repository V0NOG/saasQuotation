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

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", required: true, index: true },

    jobNumber: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["created", "scheduled", "in_progress", "completed", "canceled"],
      default: "created",
      index: true,
    },

    customerSnapshot: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
    },

    title: { type: String, default: "" },
    notes: { type: String, default: "" },

    scheduledStart: { type: Date, default: null },
    scheduledEnd: { type: Date, default: null },

    lines: { type: Array, default: [] },
    subtotalExTax: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    totalIncTax: { type: Number, default: 0 },

    statusHistory: { type: [JobStatusHistorySchema], default: [] },
  },
  { timestamps: true }
);

JobSchema.index({ quoteId: 1 }, { unique: true });
JobSchema.index({ orgId: 1, jobNumber: 1 }, { unique: true });
JobSchema.index({ orgId: 1, assignedTo: 1, createdAt: -1 });

module.exports = mongoose.model("Job", JobSchema);