// Email and SMS delivery.
// With SMTP_HOST configured, real emails are sent. Without it, messages are printed to the server console
// and the API returns the code or link in the response (development only) so the flows can be tested.
let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = require('nodemailer').createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

const smtpEnabled = () => !!transporter;
const devMode = () => !transporter && process.env.NODE_ENV !== 'production';

async function sendMail({ to, subject, text }) {
  if (!to) return false;
  if (!transporter) {
    console.log(`\n[mail] To: ${to}\n[mail] Subject: ${subject}\n[mail] ${text}\n`);
    return false;
  }
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM || 'YumYard <no-reply@yumyard.com>', to, subject, text });
    return true;
  } catch (e) {
    console.error('Email failed:', e.message);
    return false;
  }
}

// SMS hook: connect Twilio or a local gateway here.
async function sendSMS(to, text) {
  if (!to) return false;
  console.log(`[sms] ${to}: ${text}`);
  return false;
}

module.exports = { sendMail, sendSMS, smtpEnabled, devMode };
