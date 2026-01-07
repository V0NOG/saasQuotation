// backend/utils/mailer.js
const nodemailer = require("nodemailer");

function createTransport() {
  // SMTP (works with Mailgun, Sendgrid SMTP, AWS SES SMTP, etc.)
  // Required env:
  // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS).");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendQuoteEmail({ to, subject, text, html, attachments }) {
  const from = process.env.EMAIL_FROM || "no-reply@example.com";
  const transporter = createTransport();

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    attachments,
  });
}

module.exports = { sendQuoteEmail };