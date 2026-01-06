// backend/routes/auth.google.js
const express = require("express");
const passport = require("passport");
const {
  signAccessToken,
  signRefreshToken,
  setRefreshCookie,
} = require("../utils/tokens");

const router = express.Router();

/**
 * GET /api/auth/google
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    prompt: "select_account", // helpful in dev
  })
);

/**
 * GET /api/auth/google/callback
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/api/auth/google/failure",
  }),
  (req, res) => {
    const user = req.user;

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // ✅ Set refresh cookie via your helper
    setRefreshCookie(res, refreshToken);

    // ✅ Send access token to frontend in hash
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback#access=${encodeURIComponent(
      accessToken
    )}`;

    return res.redirect(302, redirectUrl);
  }
);

router.get("/google/failure", (req, res) => {
  return res.status(401).json({ message: "Google OAuth failed" });
});

module.exports = router;