import { getPrisma } from '../../shared/database';
import { generateEmailToken, hashToken } from './utils/tokens';

export type EmailTokenType = 'VERIFY_EMAIL' | 'RESET_PASSWORD';

export async function createEmailToken(
  userId: string,
  type: EmailTokenType,
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

export async function findEmailTokenByHash(tokenHash: string): Promise<{
  id: string;
  userId: string;
  type: EmailTokenType;
  expiresAt: Date;
  usedAt: Date | null;
} | null> {
  const prisma = getPrisma();
  const stored = await prisma.emailToken.findUnique({ where: { tokenHash } });
  return stored;
}

export async function markEmailTokenUsed(tokenId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.emailToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}
