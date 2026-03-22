import { ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { getPrisma } from '../../shared/database';
import { generateEmailToken, hashToken } from './utils/tokens';
import { hashPassword } from './utils/password';
import * as userRepo from './user.repository';
import { getEmailProvider } from '../notifications/utils/email-provider-factory';
import { verificationEmail, passwordResetEmail } from '../notifications/utils/email-templates';

const log = createServiceLogger('auth-email');

function getAppUrl(): string {
  return process.env['APP_URL'] ?? 'http://localhost:3000';
}

async function storeEmailToken(
  userId: string,
  type: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
  ttlMs: number,
): Promise<string> {
  const prisma = getPrisma();
  const token = generateEmailToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.emailToken.create({
    data: { userId, tokenHash, type, expiresAt },
  });

  return token;
}

async function consumeEmailToken(
  token: string,
  expectedType: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
): Promise<string> {
  const prisma = getPrisma();
  const tokenHash = hashToken(token);

  const stored = await prisma.emailToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.type !== expectedType || stored.expiresAt < new Date() || stored.usedAt) {
    throw new ValidationError('Invalid or expired token', 'INVALID_TOKEN');
  }

  await prisma.emailToken.update({
    where: { id: stored.id },
    data: { usedAt: new Date() },
  });

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

  const token = await storeEmailToken(user.id, 'RESET_PASSWORD', 60 * 60 * 1000); // 1 hour
  const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;

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
  const token = await storeEmailToken(userId, 'VERIFY_EMAIL', 24 * 60 * 60 * 1000); // 24 hours
  const verifyUrl = `${getAppUrl()}/verify-email?token=${token}`;

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
