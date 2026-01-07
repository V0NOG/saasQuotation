// backend/utils/mailer.js
const nodemailer = require("nodemailer");

function getTransport() {
  const host = process.env.SMTP_HOST || "127.0.0.1";
  const port = Number(process.env.SMTP_PORT || "1025");
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";

  const auth = user ? { user, pass } : undefined;

  return nodemailer.createTransport({
    host,
    port,
    secure: false, // MailHog is plaintext SMTP
    auth,
  });
}

/**
 * @param {{to:string, subject:string, text:string, html?:string, attachments?:any[]}} args
 */
async function sendQuoteEmail({ to, subject, text, html, attachments = [] }) {
  const from = process.env.EMAIL_FROM || "Quotify <no-reply@quotify.local>";
  const transporter = getTransport();

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    attachments,
  });

  return true;
}

module.exports = { sendQuoteEmail };