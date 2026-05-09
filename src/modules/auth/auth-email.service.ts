import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma';
import { ValidationError } from '../../shared/errors';
import type { OutboxPort } from '../../shared/outbox';
import { hashToken } from './utils/tokens';
import { hashPassword } from './utils/password';
import type { UserRepository } from './user.repository';
import type { EmailTokenRepository, EmailTokenType } from './email-token.repository';

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface AuthEmailService {
  verifyEmail(token: string): Promise<{ success: boolean }>;
  forgotPassword(email: string): Promise<{ success: boolean }>;
  resetPassword(token: string, newPassword: string): Promise<{ success: boolean }>;
}

export interface AuthEmailServiceDeps {
  prisma: PrismaClient;
  userRepo: UserRepository;
  emailTokenRepo: EmailTokenRepository;
  outbox: OutboxPort;
  appUrl: string;
  logger: Logger;
}

export function createAuthEmailService(deps: AuthEmailServiceDeps): AuthEmailService {
  const { prisma, userRepo, emailTokenRepo, outbox, appUrl, logger } = deps;

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

    await prisma.$transaction(async (tx) => {
      const token = await emailTokenRepo.createEmailToken({
        userId: user.id,
        type: 'RESET_PASSWORD',
        ttlMs: PASSWORD_RESET_TOKEN_TTL_MS,
        tx,
      });
      const resetUrl = `${appUrl}/reset-password?token=${token}`;

      await outbox.emit(
        {
          type: 'user.password_reset_requested',
          aggregateType: 'user',
          aggregateId: user.id,
          userId: user.id,
          payload: { userId: user.id, email: user.email, resetUrl },
        },
        tx,
      );
    });

    logger.info({ userId: user.id }, 'Password reset requested');
    return { success: true };
  }

  async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    const userId = await consumeEmailToken(token, 'RESET_PASSWORD');
    const passwordHash = await hashPassword(newPassword);
    await userRepo.updatePassword(userId, passwordHash);
    logger.info({ userId }, 'Password reset');
    return { success: true };
  }

  return {
    verifyEmail,
    forgotPassword,
    resetPassword,
  };
}
