// backend/utils/mailer.js
const nodemailer = require("nodemailer");

let cachedTransporter = null;

function getTransport() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST || "127.0.0.1";
  const port = Number(process.env.SMTP_PORT || "1025");
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";

  const auth = user ? { user, pass } : undefined;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: false, // MailHog is plaintext SMTP
    auth,

    // Production hardening
    pool: true,
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || "3"),
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES || "50"),

    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || "8000"),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || "8000"),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || "15000"),
  });

  return cachedTransporter;
}

/**
 * @param {{to:string, subject:string, text:string, html?:string, attachments?:any[]}} args
 * @returns {Promise<{messageId?:string, accepted?:string[], rejected?:string[]}>}
 */
async function sendQuoteEmail({ to, subject, text, html, attachments = [] }) {
  const from = process.env.EMAIL_FROM || "Quotify <no-reply@quotify.local>";
  const transporter = getTransport();

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    attachments,
  });

  return {
    messageId: info?.messageId,
    accepted: info?.accepted || [],
    rejected: info?.rejected || [],
  };
}

module.exports = { sendQuoteEmail };