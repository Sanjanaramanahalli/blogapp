const nodemailer = require('nodemailer');

let cachedTransporter = null;

// In-memory test store for E2E testing and verification
const sentTestEmails = [];

function getSentTestEmails() {
  return [...sentTestEmails];
}

function getLatestSentEmail(email) {
  for (let i = sentTestEmails.length - 1; i >= 0; i--) {
    if (!email || sentTestEmails[i].to === email.trim().toLowerCase()) {
      return sentTestEmails[i];
    }
  }
  return null;
}

function clearSentTestEmails() {
  sentTestEmails.length = 0;
}

async function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const user = (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
  const rawPass = (process.env.EMAIL_PASS || process.env.SMTP_PASS || '').trim();
  const pass = rawPass.replace(/\s+/g, '');
  const service = (process.env.EMAIL_SERVICE || process.env.SMTP_SERVICE || '').toLowerCase();
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  // 1. Gmail Transport (using App Password)
  if (user && pass && (service === 'gmail' || (!host && user.toLowerCase().endsWith('@gmail.com')))) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
    console.log(`[MAILER] Configured Gmail transport for user: ${user}`);
    return cachedTransporter;
  }

  // 2. Custom SMTP Transport
  if (host && user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
    console.log(`[MAILER] Configured custom SMTP transport (${host}:${port})`);
    return cachedTransporter;
  }

  // 3. Fast JSON/Test transport for testing and local development (prevents hanging on flaky remote test servers)
  cachedTransporter = nodemailer.createTransport({
    jsonTransport: true
  });
  console.log(`[MAILER] Initialized local test email transport (safe, instant, non-blocking)`);
  return cachedTransporter;
}

async function sendOtpEmail(toEmail, otp) {
  const transporter = await getTransporter();
  if (!transporter) {
    console.warn(`[MAILER] Transporter unavailable. Simulating email dispatch to ${toEmail}`);
    return { previewUrl: null };
  }

  const senderAddress = process.env.SMTP_FROM || process.env.EMAIL_USER || process.env.SMTP_USER || '"TownTalk Security" <security@towntalk.com>';

  const mailOptions = {
    from: senderAddress,
    to: toEmail,
    subject: 'Your TownTalk Password Reset OTP Code',
    text: `Your password reset verification code is: ${otp}. It is valid for 10 minutes. If you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; background: #0f172a; border-radius: 12px; color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #6366f1; margin: 0; font-size: 24px; font-weight: 700;">TownTalk</h2>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Security Verification</p>
        </div>
        <div style="background: #1e293b; border-radius: 8px; padding: 24px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 24px;">
          <p style="color: #e2e8f0; font-size: 15px; margin-top: 0;">Use the following One-Time Password (OTP) to verify your account and reset your password:</p>
          <div style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; background: #020617; padding: 14px 28px; border-radius: 8px; border: 1px solid #38bdf8; margin: 16px 0;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin-bottom: 0;">⏳ Valid for <strong>10 minutes</strong>. Never share this code with anyone.</p>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
          If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>
    `
  };

  const info = await transporter.sendMail(mailOptions);
  const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;

  sentTestEmails.push({
    to: toEmail.trim().toLowerCase(),
    subject: mailOptions.subject,
    otp,
    date: new Date(),
    previewUrl
  });

  console.log(`[MAILER] ✉️ OTP email successfully dispatched to registered address: ${toEmail}`);

  return { info, previewUrl };
}

module.exports = {
  sendOtpEmail,
  getLatestSentEmail,
  getSentTestEmails,
  clearSentTestEmails
};
