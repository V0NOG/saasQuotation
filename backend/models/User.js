// backend/models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Org", required: true },

    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },

    email: { type: String, required: true, lowercase: true, trim: true, index: true },

    passwordHash: { type: String, default: "" }, // empty for Google-only users
    role: { type: String, enum: ["owner", "admin", "staff"], default: "owner" },

    // ✅ Profile fields
    bio: { type: String, default: "" },
    phone: { type: String, default: "" },
    socials: {
      facebook: { type: String, default: "" },
      x: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      instagram: { type: String, default: "" },
    },
    address: {
        country: { type: String, default: "" },
        cityState: { type: String, default: "" },
        postalCode: { type: String, default: "" },
        taxId: { type: String, default: "" },
    },

    google: {
      sub: { type: String, default: "" },
      email: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

UserSchema.index({ orgId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("User", UserSchema);