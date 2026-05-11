import { createEmailTokenRepository } from '../email-token.repository';
import { hashToken } from '../utils/tokens';
import type { Prisma, PrismaClient } from '../../../generated/prisma';

function createFakePrisma(): {
  prisma: PrismaClient;
  mocks: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
} {
  const create = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();
  const prisma = {
    emailToken: { create, findUnique, update },
  } as unknown as PrismaClient;
  return { prisma, mocks: { create, findUnique, update } };
}

function createFakeTx(): {
  tx: Prisma.TransactionClient;
  create: jest.Mock;
} {
  const create = jest.fn();
  const tx = {
    emailToken: { create },
  } as unknown as Prisma.TransactionClient;
  return { tx, create };
}

describe('Email Token Repository', () => {
  describe('createEmailToken', () => {
    it('creates VERIFY_EMAIL token with hashed value and returns raw token', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue({ id: 'tok-1' });
      const repo = createEmailTokenRepository(prisma);

      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const token = await repo.createEmailToken({
        userId: 'user-1',
        type: 'VERIFY_EMAIL',
        ttlMs: 3600_000,
      });

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(mocks.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          tokenHash: hashToken(token),
          type: 'VERIFY_EMAIL',
          expiresAt: new Date(now + 3600_000),
        },
      });

      jest.restoreAllMocks();
    });

    it('creates RESET_PASSWORD token', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue({ id: 'tok-2' });
      const repo = createEmailTokenRepository(prisma);

      const token = await repo.createEmailToken({
        userId: 'user-2',
        type: 'RESET_PASSWORD',
        ttlMs: 1800_000,
      });

      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-2',
            type: 'RESET_PASSWORD',
            tokenHash: hashToken(token),
          }),
        }),
      );
    });

    it('uses provided transaction client instead of prisma when tx is given', async () => {
      const { prisma, mocks } = createFakePrisma();
      const { tx, create: txCreate } = createFakeTx();
      txCreate.mockResolvedValue({ id: 'tok-3' });
      const repo = createEmailTokenRepository(prisma);

      await repo.createEmailToken({
        userId: 'user-3',
        type: 'VERIFY_EMAIL',
        ttlMs: 60_000,
        tx,
      });

      expect(txCreate).toHaveBeenCalledTimes(1);
      expect(mocks.create).not.toHaveBeenCalled();
    });
  });

  describe('findEmailTokenByHash', () => {
    it('returns stored token when found', async () => {
      const { prisma, mocks } = createFakePrisma();
      const stored = {
        id: 'tok-1',
        userId: 'user-1',
        type: 'VERIFY_EMAIL',
        expiresAt: new Date(),
        usedAt: null,
      };
      mocks.findUnique.mockResolvedValue(stored);
      const repo = createEmailTokenRepository(prisma);

      const result = await repo.findEmailTokenByHash('abc123hash');

      expect(result).toEqual(stored);
      expect(mocks.findUnique).toHaveBeenCalledWith({ where: { tokenHash: 'abc123hash' } });
    });

    it('returns null when token not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(null);
      const repo = createEmailTokenRepository(prisma);

      const result = await repo.findEmailTokenByHash('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('markEmailTokenUsed', () => {
    it('sets usedAt to now', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue({ id: 'tok-1', usedAt: new Date() });
      const repo = createEmailTokenRepository(prisma);

      await repo.markEmailTokenUsed('tok-1');

      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'tok-1' },
        data: { usedAt: expect.any(Date) },
      });
    });
  });
});
