const Stripe = require("stripe");

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.warn("⚠️ STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(key || "sk_test_placeholder", {
  apiVersion: "2024-06-20", // ok if your Stripe account supports it
});

module.exports = { stripe };