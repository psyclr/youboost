import { randomBytes } from 'node:crypto';
import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import type { OutboxPort } from '../../shared/outbox';
import { hashPassword } from './utils/password';
import { hashToken } from './utils/tokens';
import type { UserRepository } from './user.repository';
import type { EmailTokenRepository } from './email-token.repository';

const AUTO_USER_SETUP_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AutoUserTicket {
  userId: string;
  email: string;
  setupToken: string;
  setupUrl: string;
  fresh: boolean;
}

export interface AuthAutoUserService {
  createAutoUser(email: string): Promise<AutoUserTicket>;
  setPasswordViaAutoUserToken(rawToken: string, newPassword: string): Promise<{ userId: string }>;
}

export interface AuthAutoUserServiceDeps {
  prisma: PrismaClient;
  userRepo: UserRepository;
  emailTokenRepo: EmailTokenRepository;
  outbox: OutboxPort;
  appUrl: string;
  logger: Logger;
}

export function createAuthAutoUserService(deps: AuthAutoUserServiceDeps): AuthAutoUserService {
  const { prisma, userRepo, emailTokenRepo, outbox, appUrl, logger } = deps;

  async function createAutoUser(email: string): Promise<AutoUserTicket> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await userRepo.findByEmail(normalizedEmail);
    if (existing && !existing.isAutoCreated) {
      throw new ConflictError('Account already exists for this email', 'ALREADY_REGISTERED');
    }

    const { userId, fresh } = await prisma.$transaction(async (tx) => {
      let user = existing;
      let isFresh = false;
      if (!user) {
        const randomPassword = randomBytes(32).toString('hex');
        const passwordHash = await hashPassword(randomPassword);
        const username = buildAutoUsername(normalizedEmail);
        user = await userRepo.createAutoUser(
          { email: normalizedEmail, username, passwordHash },
          tx,
        );
        isFresh = true;

        await outbox.emit(
          {
            type: 'user.registered',
            aggregateType: 'user',
            aggregateId: user.id,
            userId: user.id,
            payload: { userId: user.id, email: user.email },
          },
          tx,
        );
      }
      return { userId: user.id, fresh: isFresh };
    });

    const setupToken = await emailTokenRepo.createEmailToken({
      userId,
      type: 'AUTO_USER_SETUP',
      ttlMs: AUTO_USER_SETUP_TOKEN_TTL_MS,
    });
    const setupUrl = `${appUrl}/set-password?token=${setupToken}`;

    logger.info({ userId, fresh }, 'Auto user ticket issued');
    return { userId, email: normalizedEmail, setupToken, setupUrl, fresh };
  }

  async function setPasswordViaAutoUserToken(
    rawToken: string,
    newPassword: string,
  ): Promise<{ userId: string }> {
    const tokenHash = hashToken(rawToken);
    const stored = await emailTokenRepo.findEmailTokenByHash(tokenHash);
    if (!stored || stored.type !== 'AUTO_USER_SETUP') {
      throw new ValidationError('Invalid setup token', 'INVALID_SETUP_TOKEN');
    }
    if (stored.usedAt) {
      throw new ValidationError('Setup token already used', 'SETUP_TOKEN_USED');
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new ValidationError('Setup token expired', 'SETUP_TOKEN_EXPIRED');
    }

    const user = await userRepo.findById(stored.userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }
    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      await userRepo.finalizeAutoUser(user.id, passwordHash, tx);
      await emailTokenRepo.markEmailTokenUsed(stored.id);
      await outbox.emit(
        {
          type: 'landing.guest_account_activated',
          aggregateType: 'user',
          aggregateId: user.id,
          userId: user.id,
          payload: { userId: user.id },
        },
        tx,
      );
    });

    logger.info({ userId: user.id }, 'Auto user finalized password');
    return { userId: user.id };
  }

  return { createAutoUser, setPasswordViaAutoUserToken };
}

function buildAutoUsername(email: string): string {
  const base =
    email
      .split('@')[0]
      ?.replace(/[^a-z0-9]/gi, '')
      .slice(0, 18) ?? 'user';
  const suffix = randomBytes(4).toString('hex');
  return `${base || 'user'}_${suffix}`.slice(0, 30);
}
