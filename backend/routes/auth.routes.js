// backend/routes/auth.routes.js
const express = require("express");
const bcrypt = require("bcrypt");
const passport = require("passport"); // use global passport (server.js initializes it)
const Org = require("../models/Org");
const User = require("../models/User");

const { requireAuth } = require("../middleware/auth"); // ✅ add

const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} = require("../utils/tokens");

const router = express.Router();

/**
 * GET /api/auth/me
 * Return current user (from access token)
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "_id firstName lastName email role orgId"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      user: {
        id: user._id,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("me error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/auth/register
 */
router.post("/register", async (req, res) => {
  try {
    const { orgName, firstName, lastName, email, password } = req.body;

    if (!orgName || !email || !password) {
      return res
        .status(400)
        .json({ message: "orgName, email and password are required" });
    }

    const emailLower = String(email).toLowerCase().trim();

    // prevent duplicate
    const exists = await User.findOne({ email: emailLower });
    if (exists) return res.status(409).json({ message: "Email already in use" });

    const org = await Org.create({ name: orgName });

    const passwordHash = await bcrypt.hash(String(password), 12);
    const user = await User.create({
      orgId: org._id,
      firstName: firstName || "",
      lastName: lastName || "",
      email: emailLower,
      passwordHash,
      role: "owner",
    });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    return res.json({
      accessToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      org: {
        id: org._id,
        name: org.name,
        currency: org.currency,
        taxRate: org.taxRate,
        branding: org.branding,
      },
    });
  } catch (e) {
    console.error("register error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/auth/login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const emailLower = String(email || "").toLowerCase().trim();
    const user = await User.findOne({ email: emailLower });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(String(password || ""), user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const org = await Org.findById(user.orgId);

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    return res.json({
      accessToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      org: org
        ? {
            id: org._id,
            name: org.name,
            currency: org.currency,
            taxRate: org.taxRate,
            branding: org.branding,
          }
        : null,
    });
  } catch (e) {
    console.error("login error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/auth/google
 * Start Google OAuth
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

/**
 * GET /api/auth/google/callback
 * Google OAuth callback
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/signin`,
  }),
  async (req, res) => {
    try {
      const user = req.user;

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);
      setRefreshCookie(res, refreshToken);

      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`);
      redirectUrl.searchParams.set("accessToken", accessToken);

      return res.redirect(302, redirectUrl.toString());
    } catch (e) {
      console.error("google callback error:", e);
      return res.redirect(`${process.env.FRONTEND_URL}/signin`);
    }
  }
);

/**
 * POST /api/auth/refresh
 */
router.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: "Missing refresh token" });

    const payload = verifyRefreshToken(token);
    if (payload.type !== "refresh") {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await User.findById(payload.sub).select("_id orgId role");
    if (!user) return res.status(401).json({ message: "User not found" });

    const accessToken = signAccessToken(user);

    const newRefreshToken = signRefreshToken(user);
    setRefreshCookie(res, newRefreshToken);

    return res.json({ accessToken });
  } catch (e) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

/**
 * POST /api/auth/logout
 */
router.post("/logout", (req, res) => {
  clearRefreshCookie(res);
  return res.json({ ok: true });
});

module.exports = router;