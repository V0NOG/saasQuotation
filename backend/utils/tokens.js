const jwt = require("jsonwebtoken");

function getUserId(user) {
  return user?._id || user?.id; // supports mongoose doc + plain object
}

function signAccessToken(user) {
  const uid = getUserId(user);
  return jwt.sign(
    {
      sub: String(uid),
      orgId: String(user.orgId),
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_TTL || "15m" }
  );
}

function signRefreshToken(user) {
  const uid = getUserId(user);
  return jwt.sign(
    {
      sub: String(uid),
      orgId: String(user.orgId),
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_TTL || "30d" }
  );
}

function setRefreshCookie(res, refreshToken) {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  setRefreshCookie,
};