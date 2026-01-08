// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const passport = require("passport");

const { connectDB } = require("./config/db");
require("./config/passport");

const authRoutes = require("./routes/auth.routes");
const googleAuthRoutes = require("./routes/auth.google");
const orgRoutes = require("./routes/org.routes");
const customerRoutes = require("./routes/customer.routes");
const pricebookRoutes = require("./routes/pricebook.routes");
const quoteRoutes = require("./routes/quote.routes");
const billingRoutes = require("./routes/billing.routes");
const stripeWebhookRoutes = require("./routes/stripe.webhook");
const publicQuoteRoutes = require("./routes/publicQuote.routes");
const userRoutes = require("./routes/user.routes");
const jobRoutes = require("./routes/job.routes");

const app = express();

// ✅ trust proxy in production (Render/Railway/NGINX/LB)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(morgan("dev"));

/**
 * ✅ Stripe webhooks MUST use raw body, and must be mounted BEFORE express.json()
 * Do NOT put express.json() before this.
 */
app.use("/api/webhooks", express.raw({ type: "application/json" }), stripeWebhookRoutes);

/**
 * ✅ JSON + cookies for all non-webhook routes
 */
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// ✅ CORS allowlist (supports multiple origins)
// Use FRONTEND_URLS="http://localhost:5173,https://app.yourdomain.com"
const allowedOrigins = String(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      // allow non-browser requests (curl/postman/no origin)
      if (!origin) return cb(null, true);

      // If not configured, fail CLOSED but with a clean error
      if (allowedOrigins.length === 0) return cb(null, false);

      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  })
);

// ✅ Make preflight predictable (helps with cookies + credentials)
app.options(/.*/, cors({ credentials: true, origin: allowedOrigins }));

app.use(passport.initialize());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/auth", googleAuthRoutes);
app.use("/api/org", orgRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/pricebook", pricebookRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/jobs", jobRoutes);

/**
 * ✅ Public routes (add lightweight rate limit just for public endpoints)
 */
function createRateLimiter({ windowMs, max, keyFn }) {
  const hits = new Map(); // key -> { count, resetAt }
  return function rateLimit(req, res, next) {
    const key = (keyFn ? keyFn(req) : req.ip) || "unknown";
    const now = Date.now();

    const existing = hits.get(key);
    if (!existing || existing.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > max) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ message: "Too many requests. Please try again shortly." });
    }

    return next();
  };
}

const publicLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60, // 60 req/min per IP (tune later)
  keyFn: (req) => {
    const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return xf || req.ip || "";
  },
});

app.use("/api/public", publicLimiter, publicQuoteRoutes);

// ✅ Keep ONE user route mount (avoid duplicates)
app.use("/api/users", userRoutes);

const port = process.env.PORT || 5050;

connectDB(process.env.MONGODB_URI)
  .then(() => {
    app.listen(port, () => console.log(`✅ API running on http://localhost:${port}`));
  })
  .catch((e) => {
    console.error("❌ Mongo connect failed", e);
    process.exit(1);
  });