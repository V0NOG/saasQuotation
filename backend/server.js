// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const userRoutes = require("./routes/user.routes");

const { connectDB } = require("./config/db");
require("./config/passport");

const authRoutes = require("./routes/auth.routes");
const googleAuthRoutes = require("./routes/auth.google");
const orgRoutes = require("./routes/org.routes");
const customerRoutes = require("./routes/customer.routes");
const pricebookRoutes = require("./routes/pricebook.routes");
const quoteRoutes = require("./routes/quote.routes");

// ✅ ADD THIS
const publicQuoteRoutes = require("./routes/publicQuote.routes");

const app = express();

// ✅ Optional but recommended if you ever deploy behind proxy (Railway/Render/NGINX/Lightsail LB)
// app.set("trust proxy", 1);

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(passport.initialize());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/auth", googleAuthRoutes);
app.use("/api/org", orgRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/pricebook", pricebookRoutes);
app.use("/api/quotes", quoteRoutes);

// ✅ MOUNT PUBLIC ROUTES HERE
app.use("/api/public", publicQuoteRoutes);

app.use("/api/users", require("./routes/user.routes"));
app.use("/api/user", userRoutes);

const port = process.env.PORT || 5050;

connectDB(process.env.MONGODB_URI)
  .then(() => {
    app.listen(port, () =>
      console.log(`✅ API running on http://localhost:${port}`)
    );
  })
  .catch((e) => {
    console.error("❌ Mongo connect failed", e);
    process.exit(1);
  });