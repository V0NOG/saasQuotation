const jwt = require("jsonwebtoken");

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
    secure: isProd,       // localhost dev = false
    sameSite: "lax",      // works with OAuth redirects on localhost
    path: "/api/auth",    // cookie only sent to auth routes
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
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

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshCookieOptions,
  setRefreshCookie,
  clearRefreshCookie,
};