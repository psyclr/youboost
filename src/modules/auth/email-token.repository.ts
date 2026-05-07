import { getPrisma } from '../../shared/database';
import type { PrismaClient } from '../../generated/prisma';
import { generateEmailToken, hashToken } from './utils/tokens';

export type EmailTokenType = 'VERIFY_EMAIL' | 'RESET_PASSWORD';

export interface EmailTokenRepository {
  createEmailToken(userId: string, type: EmailTokenType, ttlMs: number): Promise<string>;
  findEmailTokenByHash(tokenHash: string): Promise<{
    id: string;
    userId: string;
    type: EmailTokenType;
    expiresAt: Date;
    usedAt: Date | null;
  } | null>;
  markEmailTokenUsed(tokenId: string): Promise<void>;
}

export function createEmailTokenRepository(prisma: PrismaClient): EmailTokenRepository {
  async function createEmailToken(
    userId: string,
    type: EmailTokenType,
    ttlMs: number,
  ): Promise<string> {
    const token = generateEmailToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + ttlMs);

    await prisma.emailToken.create({
      data: { userId, tokenHash, type, expiresAt },
    });

    return token;
  }

  async function findEmailTokenByHash(tokenHash: string): Promise<{
    id: string;
    userId: string;
    type: EmailTokenType;
    expiresAt: Date;
    usedAt: Date | null;
  } | null> {
    const stored = await prisma.emailToken.findUnique({ where: { tokenHash } });
    return stored;
  }

  async function markEmailTokenUsed(tokenId: string): Promise<void> {
    await prisma.emailToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    });
  }

  return { createEmailToken, findEmailTokenByHash, markEmailTokenUsed };
}

// Deprecated shims — delegate to factory with shared prisma. Delete in Phase 18.
export async function createEmailToken(
  userId: string,
  type: EmailTokenType,
  ttlMs: number,
): Promise<string> {
  return createEmailTokenRepository(getPrisma()).createEmailToken(userId, type, ttlMs);
}

export async function findEmailTokenByHash(tokenHash: string): Promise<{
  id: string;
  userId: string;
  type: EmailTokenType;
  expiresAt: Date;
  usedAt: Date | null;
} | null> {
  return createEmailTokenRepository(getPrisma()).findEmailTokenByHash(tokenHash);
}

export async function markEmailTokenUsed(tokenId: string): Promise<void> {
  return createEmailTokenRepository(getPrisma()).markEmailTokenUsed(tokenId);
}
