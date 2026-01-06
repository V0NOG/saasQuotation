const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const passport = require("../config/passport");
const Org = require("../models/Org");
const User = require("../models/User");
const { signAccessToken, signRefreshToken, setRefreshCookie, clearRefreshCookie } = require("../utils/tokens");

const router = express.Router();

function buildAccessPayload(user) {
  return { userId: user._id.toString(), orgId: user.orgId.toString(), role: user.role };
}

router.post("/register", async (req, res) => {
  const { orgName, firstName, lastName, email, password } = req.body;

  if (!orgName || !email || !password) {
    return res.status(400).json({ message: "orgName, email and password are required" });
  }

  const org = await Org.create({ name: orgName });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    orgId: org._id,
    firstName: firstName || "",
    lastName: lastName || "",
    email: email.toLowerCase(),
    passwordHash,
    role: "owner"
  });

  const access = signAccessToken(buildAccessPayload(user), process.env.JWT_ACCESS_SECRET, process.env.ACCESS_TOKEN_TTL);
  const refresh = signRefreshToken(buildAccessPayload(user), process.env.JWT_REFRESH_SECRET, process.env.REFRESH_TOKEN_TTL);
  setRefreshCookie(res, refresh);

  return res.json({
    accessToken: access,
    user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
    org: { id: org._id, name: org.name, currency: org.currency, taxRate: org.taxRate, branding: org.branding }
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: (email || "").toLowerCase() });
  if (!user || !user.passwordHash) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password || "", user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const org = await Org.findById(user.orgId);

  const access = signAccessToken(buildAccessPayload(user), process.env.JWT_ACCESS_SECRET, process.env.ACCESS_TOKEN_TTL);
  const refresh = signRefreshToken(buildAccessPayload(user), process.env.JWT_REFRESH_SECRET, process.env.REFRESH_TOKEN_TTL);
  setRefreshCookie(res, refresh);

  return res.json({
    accessToken: access,
    user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
    org: { id: org._id, name: org.name, currency: org.currency, taxRate: org.taxRate, branding: org.branding }
  });
});

// Google OAuth start
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${process.env.FRONTEND_URL}/signin` }),
  async (req, res) => {
    const user = req.user;
    const org = await Org.findById(user.orgId);

    const access = signAccessToken(buildAccessPayload(user), process.env.JWT_ACCESS_SECRET, process.env.ACCESS_TOKEN_TTL);
    const refresh = signRefreshToken(buildAccessPayload(user), process.env.JWT_REFRESH_SECRET, process.env.REFRESH_TOKEN_TTL);
    setRefreshCookie(res, refresh);

    // Redirect back to frontend with access token
    // (Refresh token stays httpOnly cookie)
    const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`);
    redirectUrl.searchParams.set("accessToken", access);

    res.redirect(redirectUrl.toString());
  }
);

// Refresh: uses httpOnly cookie
router.post("/refresh", async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: "Missing refresh token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const access = signAccessToken(
      { userId: payload.userId, orgId: payload.orgId, role: payload.role },
      process.env.JWT_ACCESS_SECRET,
      process.env.ACCESS_TOKEN_TTL
    );

    return res.json({ accessToken: access });
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

router.post("/logout", (req, res) => {
  clearRefreshCookie(res);
  res.json({ ok: true });
});

module.exports = router;