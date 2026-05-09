import type { Prisma, PrismaClient } from '../../generated/prisma';
import { generateEmailToken, hashToken } from './utils/tokens';

type PrismaTransactionClient = Prisma.TransactionClient;

export type EmailTokenType = 'VERIFY_EMAIL' | 'RESET_PASSWORD';

export interface CreateEmailTokenParams {
  userId: string;
  type: EmailTokenType;
  ttlMs: number;
  tx?: PrismaTransactionClient;
}

export interface EmailTokenRepository {
  createEmailToken(params: CreateEmailTokenParams): Promise<string>;
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
  async function createEmailToken(params: CreateEmailTokenParams): Promise<string> {
    const { userId, type, ttlMs, tx } = params;
    const token = generateEmailToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + ttlMs);

    const client = tx ?? prisma;
    await client.emailToken.create({
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
