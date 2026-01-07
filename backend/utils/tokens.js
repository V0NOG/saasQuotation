// backend/utils/tokens.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      orgId: String(user.orgId),
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_TTL || "15m" }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      orgId: String(user.orgId),
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_TTL || "30d" }
  );
}

function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie("refreshToken", refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  res.clearCookie("refreshToken", {
    ...refreshCookieOptions(),
    maxAge: 0,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

// Public quote token (unguessable, URL-safe)
// 32 bytes => 256-bit security. You can tweak via env if desired.
function generatePublicToken() {
  const bytes = Math.max(parseInt(process.env.QUOTE_PUBLIC_TOKEN_BYTES || "32", 10), 16);
  return crypto.randomBytes(bytes).toString("base64url");
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshCookieOptions,
  setRefreshCookie,
  clearRefreshCookie,
  generatePublicToken,
};