/**
 * Email transport.
 *
 * Sends transactional mail via Gmail SMTP using an App Password.
 * Set GMAIL_USER and GMAIL_APP_PASSWORD in your environment.
 * GMAIL_USER should be rahulsunny13@gmail.com.
 *
 * To create an App Password:
 *   1. Enable 2-Step Verification on the Gmail account.
 *   2. Visit https://myaccount.google.com/apppasswords
 *   3. Create an app password for "Mail" → copy the 16-char code.
 *   4. Set GMAIL_APP_PASSWORD to that code (no spaces).
 */

import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER ?? '';
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD ?? '';
const SITE_URL = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
const SITE_NAME = 'Codifie Scan';

function createTransport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.warn('[email] GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping verification email');
    return;
  }

  const verifyUrl = `${SITE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  const transport = createTransport();
  await transport.sendMail({
    from: `"${SITE_NAME}" <${GMAIL_USER}>`,
    to,
    subject: `Verify your ${SITE_NAME} email`,
    text: `Hi,\n\nThanks for signing up! Confirm your email address by visiting:\n\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account you can ignore this email.\n\n— The ${SITE_NAME} team`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:12px;padding:40px;border:1px solid #e4e4e7;">
        <tr><td>
          <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#18181b;">${SITE_NAME}</p>
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#18181b;">Confirm your email address</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.5;">
            Thanks for signing up! Click the button below to verify your email and activate your account.
          </p>
          <a href="${verifyUrl}"
             style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
            Verify email
          </a>
          <p style="margin:24px 0 0;font-size:13px;color:#a1a1aa;">
            Or copy this link:<br>
            <span style="color:#6366f1;word-break:break-all;">${verifyUrl}</span>
          </p>
          <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">
            Link expires in 24 hours. If you didn't sign up, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
