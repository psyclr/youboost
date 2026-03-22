function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #18181b; padding: 24px 32px; color: #fff; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { padding: 32px; color: #27272a; line-height: 1.6; }
    .btn { display: inline-block; padding: 12px 24px; background: #18181b; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .footer { padding: 16px 32px; text-align: center; font-size: 12px; color: #a1a1aa; border-top: 1px solid #e4e4e7; }
    .code { background: #f4f4f5; padding: 12px 16px; border-radius: 6px; font-family: monospace; font-size: 14px; letter-spacing: 1px; text-align: center; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>YouBoost</h1></div>
    <div class="body">${content}</div>
    <div class="footer">&copy; ${new Date().getFullYear()} YouBoost. All rights reserved.</div>
  </div>
</body>
</html>`;
}

export function verificationEmail(verifyUrl: string): { subject: string; body: string } {
  return {
    subject: 'Verify your email — YouBoost',
    body: baseTemplate(`
      <h2>Verify Your Email</h2>
      <p>Thank you for signing up! Please verify your email address to get started.</p>
      <p style="text-align:center"><a class="btn" href="${verifyUrl}">Verify Email</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <div class="code">${verifyUrl}</div>
      <p>This link expires in 24 hours.</p>
    `),
  };
}

export function passwordResetEmail(resetUrl: string): { subject: string; body: string } {
  return {
    subject: 'Reset your password — YouBoost',
    body: baseTemplate(`
      <h2>Reset Your Password</h2>
      <p>We received a request to reset your password. Click the button below to choose a new one.</p>
      <p style="text-align:center"><a class="btn" href="${resetUrl}">Reset Password</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <div class="code">${resetUrl}</div>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
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
