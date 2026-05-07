import { ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { getConfig } from '../../shared/config';
import { hashToken } from './utils/tokens';
import { hashPassword } from './utils/password';
import * as userRepo from './user.repository';
import * as emailTokenRepo from './email-token.repository';
import type { EmailTokenType } from './email-token.repository';
import { getEmailProvider } from '../notifications/utils/email-provider-factory';
import { verificationEmail, passwordResetEmail } from '../notifications/utils/email-templates';

const log = createServiceLogger('auth-email');

async function consumeEmailToken(token: string, expectedType: EmailTokenType): Promise<string> {
  const tokenHash = hashToken(token);

  const stored = await emailTokenRepo.findEmailTokenByHash(tokenHash);
  if (stored?.type !== expectedType || stored.expiresAt < new Date() || stored.usedAt) {
    throw new ValidationError('Invalid or expired token', 'INVALID_TOKEN');
  }

  await emailTokenRepo.markEmailTokenUsed(stored.id);
  return stored.userId;
}

export async function verifyEmail(token: string): Promise<{ success: boolean }> {
  const userId = await consumeEmailToken(token, 'VERIFY_EMAIL');
  await userRepo.setEmailVerified(userId);
  log.info({ userId }, 'Email verified');
  return { success: true };
}

export async function forgotPassword(email: string): Promise<{ success: boolean }> {
  const user = await userRepo.findByEmail(email);
  if (!user) {
    // Return success to prevent email enumeration
    return { success: true };
  }

  const token = await emailTokenRepo.createEmailToken(user.id, 'RESET_PASSWORD', 60 * 60 * 1000);
  const resetUrl = `${getConfig().app.url}/reset-password?token=${token}`;

  try {
    const emailContent = passwordResetEmail(resetUrl);
    const provider = getEmailProvider();
    await provider.send({
      to: user.email,
      subject: emailContent.subject,
      body: emailContent.body,
    });
    log.info({ userId: user.id }, 'Password reset email sent');
  } catch (err) {
    log.error({ err, userId: user.id }, 'Failed to send password reset email');
  }

  return { success: true };
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  const userId = await consumeEmailToken(token, 'RESET_PASSWORD');
  const passwordHash = await hashPassword(newPassword);
  await userRepo.updatePassword(userId, passwordHash);
  log.info({ userId }, 'Password reset');
  return { success: true };
}

export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const token = await emailTokenRepo.createEmailToken(userId, 'VERIFY_EMAIL', 24 * 60 * 60 * 1000);
  const verifyUrl = `${getConfig().app.url}/verify-email?token=${token}`;

  try {
    const emailContent = verificationEmail(verifyUrl);
    const provider = getEmailProvider();
    await provider.send({
      to: email,
      subject: emailContent.subject,
      body: emailContent.body,
    });
    log.info({ userId }, 'Verification email sent');
  } catch (err) {
    log.error({ err, userId }, 'Failed to send verification email');
  }
}
