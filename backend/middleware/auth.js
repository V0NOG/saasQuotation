const { verifyAccessToken } = require("../utils/tokens");

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ message: "Missing or invalid Authorization header" });
    }

    const payload = verifyAccessToken(token);

    // Attach user-ish info for downstream use
    req.user = {
      id: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
    };

    return next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}

module.exports = { requireAuth };