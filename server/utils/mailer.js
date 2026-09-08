const nodemailer = require('nodemailer');

let cachedTransporter = null;

async function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  // Use custom SMTP credentials if provided in environment
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    console.log(`[MAILER] Configured custom SMTP transport using host: ${process.env.SMTP_HOST}`);
    return cachedTransporter;
  }

  // Otherwise, automatically create an Ethereal test inbox transport
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log(`[MAILER] Created Ethereal test email account: ${testAccount.user}`);
    return cachedTransporter;
  } catch (err) {
    console.error('[MAILER] Failed to create Ethereal test account:', err);
    // Fallback in case of offline network issues
    return null;
  }
}

async function sendOtpEmail(toEmail, otp) {
  const transporter = await getTransporter();
  if (!transporter) {
    console.warn(`[MAILER] Transporter unavailable. Simulating email dispatch to ${toEmail}`);
    return { previewUrl: null };
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || '"ApexBlog Security" <security@apexblog.com>',
    to: toEmail,
    subject: 'Your ApexBlog Password Reset OTP Code',
    text: `Your password reset verification code is: ${otp}. It is valid for 10 minutes. If you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; background: #0f172a; border-radius: 12px; color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #6366f1; margin: 0; font-size: 24px; font-weight: 700;">ApexBlog</h2>
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
  const previewUrl = nodemailer.getTestMessageUrl(info);

  if (previewUrl) {
    console.log(`[MAILER] ✉️ Real Email Delivered to Inbox! View in Ethereal: ${previewUrl}`);
  }

  return { info, previewUrl };
}

module.exports = {
  sendOtpEmail
};
