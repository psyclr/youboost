import type { Logger } from 'pino';
import { ValidationError } from '../../shared/errors';
import { hashToken } from './utils/tokens';
import { hashPassword } from './utils/password';
import type { UserRepository } from './user.repository';
import type { EmailTokenRepository, EmailTokenType } from './email-token.repository';
import { verificationEmail, passwordResetEmail } from '../notifications';
import type { EmailProvider } from '../notifications';

export interface AuthEmailService {
  verifyEmail(token: string): Promise<{ success: boolean }>;
  forgotPassword(email: string): Promise<{ success: boolean }>;
  resetPassword(token: string, newPassword: string): Promise<{ success: boolean }>;
  sendVerificationEmail(userId: string, email: string): Promise<void>;
}

export interface AuthEmailServiceDeps {
  userRepo: UserRepository;
  emailTokenRepo: EmailTokenRepository;
  emailProvider: EmailProvider;
  appUrl: string;
  logger: Logger;
}

export function createAuthEmailService(deps: AuthEmailServiceDeps): AuthEmailService {
  const { userRepo, emailTokenRepo, emailProvider, appUrl, logger } = deps;

  async function consumeEmailToken(token: string, expectedType: EmailTokenType): Promise<string> {
    const tokenHash = hashToken(token);

    const stored = await emailTokenRepo.findEmailTokenByHash(tokenHash);
    if (stored?.type !== expectedType || stored.expiresAt < new Date() || stored.usedAt) {
      throw new ValidationError('Invalid or expired token', 'INVALID_TOKEN');
    }

    await emailTokenRepo.markEmailTokenUsed(stored.id);
    return stored.userId;
  }

  async function verifyEmail(token: string): Promise<{ success: boolean }> {
    const userId = await consumeEmailToken(token, 'VERIFY_EMAIL');
    await userRepo.setEmailVerified(userId);
    logger.info({ userId }, 'Email verified');
    return { success: true };
  }

  async function forgotPassword(email: string): Promise<{ success: boolean }> {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      // Return success to prevent email enumeration
      return { success: true };
    }

    const token = await emailTokenRepo.createEmailToken(user.id, 'RESET_PASSWORD', 60 * 60 * 1000);
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    try {
      const emailContent = passwordResetEmail(resetUrl);
      await emailProvider.send({
        to: user.email,
        subject: emailContent.subject,
        body: emailContent.body,
      });
      logger.info({ userId: user.id }, 'Password reset email sent');
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to send password reset email');
    }

    return { success: true };
  }

  async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    const userId = await consumeEmailToken(token, 'RESET_PASSWORD');
    const passwordHash = await hashPassword(newPassword);
    await userRepo.updatePassword(userId, passwordHash);
    logger.info({ userId }, 'Password reset');
    return { success: true };
  }

  async function sendVerificationEmail(userId: string, email: string): Promise<void> {
    const token = await emailTokenRepo.createEmailToken(
      userId,
      'VERIFY_EMAIL',
      24 * 60 * 60 * 1000,
    );
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;

    try {
      const emailContent = verificationEmail(verifyUrl);
      await emailProvider.send({
        to: email,
        subject: emailContent.subject,
        body: emailContent.body,
      });
      logger.info({ userId }, 'Verification email sent');
    } catch (err) {
      logger.error({ err, userId }, 'Failed to send verification email');
    }
  }

  return {
    verifyEmail,
    forgotPassword,
    resetPassword,
    sendVerificationEmail,
  };
}
