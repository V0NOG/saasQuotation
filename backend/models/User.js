const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Org", required: true },

    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },

    email: { type: String, required: true, lowercase: true, trim: true, index: true },

    passwordHash: { type: String, default: "" }, // empty for Google-only users
    role: { type: String, enum: ["owner", "admin", "staff"], default: "owner" },

    google: {
      sub: { type: String, default: "" }, // Google user id
      email: { type: String, default: "" }
    }
  },
  { timestamps: true }
);

// unique per org (same email can exist in different orgs if you want)
// If you prefer global unique emails, change index to { unique: true } without orgId.
UserSchema.index({ orgId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("User", UserSchema);