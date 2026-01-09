// backend/routes/user.routes.js
const express = require("express");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function toUserDTO(u) {
  return {
    id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    bio: u.bio || "",
    phone: u.phone || "",
    socials: {
      facebook: u.socials?.facebook || "",
      x: u.socials?.x || "",
      linkedin: u.socials?.linkedin || "",
      instagram: u.socials?.instagram || "",
    },
    address: {
        country: u.address?.country || "",
        cityState: u.address?.cityState || "",
        postalCode: u.address?.postalCode || "",
        taxId: u.address?.taxId || "",
    },
  };
}

// GET /api/users  (admin/owner only) - list users in org for assignment
router.get("/", requireAuth, async (req, res) => {
  try {
    const role = req.user.role;
    if (role !== "owner" && role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const orgId = req.user.orgId;

    const search = String(req.query.search || "").trim();
    const roleFilter = String(req.query.role || "").trim(); // optional: "staff" | "admin" | "owner"

    const filter = { orgId };

    if (roleFilter && ["owner", "admin", "staff"].includes(roleFilter)) {
      filter.role = roleFilter;
    }

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
    }

    const users = await User.find(filter)
      .sort({ firstName: 1, lastName: 1 })
      .select("_id firstName lastName email role");

    return res.json({ items: users.map(toUserDTO) });
  } catch (e) {
    console.error("users list error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/user/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user: toUserDTO(user) });
  } catch (e) {
    console.error("user me error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/user/me
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const updates = req.body || {};

    const allowed = {};
    if (typeof updates.firstName === "string") allowed.firstName = updates.firstName;
    if (typeof updates.lastName === "string") allowed.lastName = updates.lastName;
    if (typeof updates.bio === "string") allowed.bio = updates.bio;
    if (typeof updates.phone === "string") allowed.phone = updates.phone;

    if (updates.socials && typeof updates.socials === "object") {
      allowed.socials = {};
      if (typeof updates.socials.facebook === "string") allowed.socials.facebook = updates.socials.facebook;
      if (typeof updates.socials.x === "string") allowed.socials.x = updates.socials.x;
      if (typeof updates.socials.linkedin === "string") allowed.socials.linkedin = updates.socials.linkedin;
      if (typeof updates.socials.instagram === "string") allowed.socials.instagram = updates.socials.instagram;
    }
    if (updates.address && typeof updates.address === "object") {
        allowed.address = {};
        if (typeof updates.address.country === "string") allowed.address.country = updates.address.country;
        if (typeof updates.address.cityState === "string") allowed.address.cityState = updates.address.cityState;
        if (typeof updates.address.postalCode === "string") allowed.address.postalCode = updates.address.postalCode;
        if (typeof updates.address.taxId === "string") allowed.address.taxId = updates.address.taxId;
    }

    const user = await User.findByIdAndUpdate(req.user.id, allowed, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user: toUserDTO(user) });
  } catch (e) {
    console.error("user patch error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;