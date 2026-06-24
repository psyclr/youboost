// Brand tokens mirror frontend globals.css (--brand-*). Email clients can't load
// Google Fonts or SVG logos, so the wordmark + play mark are built from HTML/CSS
// (a red rounded tile with a white play triangle), and the font falls back to a
// system stack. Critical styles (button, header) are also inlined because some
// clients (Outlook) strip <style> in <head>.
const BRAND = {
  red: '#F10004',
  redDeep: '#D40026',
  ink: '#0F0F0F',
  page: '#f4f4f5',
  text: '#27272a',
  muted: '#71717a',
  border: '#e4e4e7',
  soft: '#f4f4f5',
} as const;

const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: ${BRAND.page}; font-family: ${FONT}; }
    .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(15,15,15,0.10); }
    .header { background: ${BRAND.ink}; padding: 22px 32px; }
    .logo-tile { display: inline-block; width: 30px; height: 30px; background: ${BRAND.red}; border-radius: 8px; text-align: center; vertical-align: middle; }
    .logo-tri { display: inline-block; width: 0; height: 0; border-style: solid; border-width: 7px 0 7px 11px; border-color: transparent transparent transparent #fff; margin-top: 8px; margin-left: 2px; }
    .logo-word { display: inline-block; vertical-align: middle; margin-left: 10px; color: #fff; font-size: 20px; font-weight: 700; letter-spacing: -0.2px; }
    .body { padding: 32px; color: ${BRAND.text}; line-height: 1.6; font-size: 15px; }
    .body h2 { margin: 0 0 12px; font-size: 22px; color: ${BRAND.ink}; }
    .btn { display: inline-block; padding: 13px 28px; background: ${BRAND.red}; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 16px 0; }
    .footer { padding: 20px 32px; text-align: center; font-size: 12px; color: #a1a1aa; border-top: 1px solid ${BRAND.border}; }
    .footer a { color: ${BRAND.muted}; text-decoration: none; }
    .code { background: ${BRAND.soft}; padding: 12px 16px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 13px; word-break: break-all; color: ${BRAND.text}; margin: 16px 0; }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};font-family:${FONT}">
  <div class="container" style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,15,15,0.10)">
    <div class="header" style="background:${BRAND.ink};padding:22px 32px">
      <span class="logo-tile" style="display:inline-block;width:30px;height:30px;background:${BRAND.red};border-radius:8px;text-align:center;vertical-align:middle">
        <span class="logo-tri" style="display:inline-block;width:0;height:0;border-style:solid;border-width:7px 0 7px 11px;border-color:transparent transparent transparent #fff;margin-top:8px;margin-left:2px"></span>
      </span>
      <span class="logo-word" style="display:inline-block;vertical-align:middle;margin-left:10px;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.2px">YouBoost</span>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} YouBoost &middot; <a href="https://www.youboost.store">youboost.store</a>
    </div>
  </div>
</body>
</html>`;
}

// Inline-styled CTA so it renders branded even where <style> is stripped.
function button(href: string, label: string): string {
  return `<a class="btn" href="${href}" style="display:inline-block;padding:13px 28px;background:${BRAND.red};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;margin:16px 0">${label}</a>`;
}

export function verificationEmail(verifyUrl: string): { subject: string; body: string } {
  return {
    subject: 'Verify your email — YouBoost',
    body: baseTemplate(`
      <h2>Verify Your Email</h2>
      <p>Thanks for signing up! Confirm your email address to get started.</p>
      <p style="text-align:center">${button(verifyUrl, 'Verify Email')}</p>
      <p style="color:${BRAND.muted};font-size:13px">Or paste this link into your browser:</p>
      <div class="code">${verifyUrl}</div>
      <p style="color:${BRAND.muted};font-size:13px">This link expires in 24 hours.</p>
    `),
  };
}

export function accountSetupEmail(setupUrl: string): { subject: string; body: string } {
  return {
    subject: 'Complete your YouBoost account',
    body: baseTemplate(`
      <h2>Your account is ready</h2>
      <p>Thanks for your order! We set up an account so you can track it and manage future boosts. Choose a password to access your dashboard.</p>
      <p style="text-align:center">${button(setupUrl, 'Set Your Password')}</p>
      <p style="color:${BRAND.muted};font-size:13px">Or paste this link into your browser:</p>
      <div class="code">${setupUrl}</div>
      <p style="color:${BRAND.muted};font-size:13px">This link expires in 7 days.</p>
    `),
  };
}

export function passwordResetEmail(resetUrl: string): { subject: string; body: string } {
  return {
    subject: 'Reset your password — YouBoost',
    body: baseTemplate(`
      <h2>Reset Your Password</h2>
      <p>We received a request to reset your password. Choose a new one below.</p>
      <p style="text-align:center">${button(resetUrl, 'Reset Password')}</p>
      <p style="color:${BRAND.muted};font-size:13px">Or paste this link into your browser:</p>
      <div class="code">${resetUrl}</div>
      <p style="color:${BRAND.muted};font-size:13px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `),
  };
}

export function orderFailedEmail(params: {
  orderId: string;
  reason: string;
  refundAmount?: number;
}): { subject: string; body: string } {
  const shortId = params.orderId.slice(0, 8);
  // Only promise a refund when one actually happened (refundAmount set by the
  // failure that credited the wallet). Other failures must not over-promise.
  if (typeof params.refundAmount === 'number') {
    return {
      subject: "We couldn't start your order — refunded to your balance",
      body: baseTemplate(`
      <h2>We couldn't start your order</h2>
      <p>Sorry — we weren't able to start your order <strong>#${shortId}</strong> right now.</p>
      <p>We've returned <strong>$${params.refundAmount.toFixed(2)}</strong> to your YouBoost account balance, so you haven't lost anything. You can use it to place another order right away.</p>
      <p style="text-align:center">${button('https://www.youboost.store/billing', 'View your balance')}</p>
      <p style="color:${BRAND.muted};font-size:13px">If anything looks off, just reply to this email and we'll help.</p>
    `),
    };
  }
  const timedOut = params.reason === 'timeout';
  return {
    subject: timedOut ? 'Your order timed out' : 'Your order could not be completed',
    body: baseTemplate(`
      <h2>${timedOut ? 'Your order timed out' : 'Order could not be completed'}</h2>
      <p>Unfortunately your order <strong>#${shortId}</strong> could not be completed.</p>
      <p>If you were charged, the amount has been returned to your YouBoost balance. Need a hand? Just reply to this email.</p>
    `),
  };
}

export function orderCreatedEmail(params: {
  orderId: string;
  serviceName: string;
  quantity: number;
  price: number;
}): { subject: string; body: string } {
  return {
    subject: `Order #${params.orderId.slice(0, 8)} created — YouBoost`,
    body: baseTemplate(`
      <h2>Order Created</h2>
      <p>Your order has been placed successfully!</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#71717a">Order ID</td><td style="padding:8px 0;text-align:right;font-family:monospace">${params.orderId.slice(0, 8)}...</td></tr>
        <tr><td style="padding:8px 0;color:#71717a">Service</td><td style="padding:8px 0;text-align:right">${params.serviceName}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a">Quantity</td><td style="padding:8px 0;text-align:right">${params.quantity.toLocaleString()}</td></tr>
        <tr style="border-top:1px solid #e4e4e7"><td style="padding:8px 0;font-weight:600">Total</td><td style="padding:8px 0;text-align:right;font-weight:600">$${params.price.toFixed(2)}</td></tr>
      </table>
    `),
  };
}

export function orderCancelledEmail(
  orderId: string,
  refundAmount: number,
): { subject: string; body: string } {
  return {
    subject: `Order #${orderId.slice(0, 8)} cancelled — YouBoost`,
    body: baseTemplate(`
      <h2>Order Cancelled</h2>
      <p>Your order <strong>#${orderId.slice(0, 8)}</strong> has been cancelled.</p>
      <p>Refund of <strong>$${refundAmount.toFixed(2)}</strong> has been returned to your wallet balance.</p>
    `),
  };
}

export function depositConfirmedEmail(amount: number): { subject: string; body: string } {
  return {
    subject: `Deposit of $${amount.toFixed(2)} confirmed — YouBoost`,
    body: baseTemplate(`
      <h2>Deposit Confirmed</h2>
      <p>Your deposit of <strong>$${amount.toFixed(2)}</strong> has been confirmed and added to your wallet balance.</p>
    `),
  };
}

export function ticketReplyEmail(
  ticketSubject: string,
  _ticketId: string,
): { subject: string; body: string } {
  return {
    subject: `Re: ${ticketSubject} — YouBoost Support`,
    body: baseTemplate(`
      <h2>New Reply on Your Ticket</h2>
      <p>A support agent has replied to your ticket: <strong>${ticketSubject}</strong></p>
      <p>Please check your dashboard for the full reply.</p>
    `),
  };
}
