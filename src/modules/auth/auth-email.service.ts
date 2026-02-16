import { ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { generateEmailToken, hashToken } from './utils/tokens';
import { hashPassword } from './utils/password';
import * as userRepo from './user.repository';

const log = createServiceLogger('auth-email');

// In-memory store for dev/test. Will be replaced by DB + notification service.
const emailTokens = new Map<string, { userId: string; type: string; expiresAt: Date }>();

export async function verifyEmail(token: string): Promise<{ success: boolean }> {
  const tokenHash = hashToken(token);
  const stored = emailTokens.get(tokenHash);
  if (!stored || stored.type !== 'verify' || stored.expiresAt < new Date()) {
    throw new ValidationError('Invalid or expired verification token', 'INVALID_TOKEN');
  }

  await userRepo.setEmailVerified(stored.userId);
  emailTokens.delete(tokenHash);
  log.info({ userId: stored.userId }, 'Email verified');
  return { success: true };
}

export async function forgotPassword(email: string): Promise<{ success: boolean }> {
  const user = await userRepo.findByEmail(email);
  if (!user) {
    // Return success even if user not found (prevent email enumeration)
    return { success: true };
  }

  const token = generateEmailToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  emailTokens.set(tokenHash, { userId: user.id, type: 'reset', expiresAt });

  // STUB: Log token instead of sending email
  log.info({ userId: user.id, token }, 'EMAIL STUB: password reset token generated');
  return { success: true };
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  const tokenHash = hashToken(token);
  const stored = emailTokens.get(tokenHash);
  if (!stored || stored.type !== 'reset' || stored.expiresAt < new Date()) {
    throw new ValidationError('Invalid or expired reset token', 'INVALID_TOKEN');
  }

  const passwordHash = await hashPassword(newPassword);
  await userRepo.updatePassword(stored.userId, passwordHash);
  emailTokens.delete(tokenHash);
  log.info({ userId: stored.userId }, 'Password reset');
  return { success: true };
}

// Helper for testing: create a verification token
export function createVerificationToken(userId: string): string {
  const token = generateEmailToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  emailTokens.set(tokenHash, { userId, type: 'verify', expiresAt });
  log.info({ userId, token }, 'EMAIL STUB: verification token generated');
  return token;
}
