import type { Prisma, PrismaClient } from '../../../generated/prisma';
import { createAuthEmailService } from '../auth-email.service';
import {
  createFakeUserRepository,
  createFakeEmailTokenRepository,
  createFakeOutbox,
  silentLogger,
} from './fakes';

jest.mock('../utils/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('new-hash'),
}));

jest.mock('../utils/tokens', () => ({
  hashToken: (input: string): string => input, // identity hash so tests can control storage keys
}));

const mockUser = {
  id: 'user-1',
  email: 'a@b.com',
  username: 'testuser',
  passwordHash: 'hash',
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createFakePrisma(): PrismaClient {
  const tx = {} as Prisma.TransactionClient;
  return {
    $transaction: async <T>(cb: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => cb(tx),
  } as unknown as PrismaClient;
}

function setup(seed: { users?: Array<typeof mockUser> } = {}): {
  service: ReturnType<typeof createAuthEmailService>;
  userRepo: ReturnType<typeof createFakeUserRepository>;
  emailTokenRepo: ReturnType<typeof createFakeEmailTokenRepository>;
  outbox: ReturnType<typeof createFakeOutbox>;
} {
  const userRepo = createFakeUserRepository(seed);
  const emailTokenRepo = createFakeEmailTokenRepository();
  const outbox = createFakeOutbox();
  const prisma = createFakePrisma();
  const service = createAuthEmailService({
    prisma,
    userRepo,
    emailTokenRepo,
    outbox: outbox.port,
    appUrl: 'https://app.test',
    logger: silentLogger,
  });
  return { service, userRepo, emailTokenRepo, outbox };
}

describe('Auth Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const { service, emailTokenRepo, userRepo } = setup({ users: [mockUser] });
      // Seed a VERIFY_EMAIL token directly
      emailTokenRepo.store.set('valid-token', {
        id: 'et-seed',
        userId: 'user-1',
        tokenHash: 'valid-token',
        type: 'VERIFY_EMAIL',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });

      const result = await service.verifyEmail('valid-token');

      expect(result.success).toBe(true);
      expect(userRepo.calls.setEmailVerified).toEqual(['user-1']);
      expect(emailTokenRepo.calls.markEmailTokenUsed).toEqual(['et-seed']);
    });

    it('should throw on invalid token', async () => {
      const { service } = setup();
      await expect(service.verifyEmail('bad')).rejects.toThrow('Invalid or expired');
    });

    it('should throw on expired token', async () => {
      const { service, emailTokenRepo } = setup();
      emailTokenRepo.store.set('expired', {
        id: 'et-2',
        userId: 'user-1',
        tokenHash: 'expired',
        type: 'VERIFY_EMAIL',
        expiresAt: new Date(Date.now() - 60_000),
        usedAt: null,
      });
      await expect(service.verifyEmail('expired')).rejects.toThrow('Invalid or expired');
    });

    it('should throw on already used token', async () => {
      const { service, emailTokenRepo } = setup();
      emailTokenRepo.store.set('used', {
        id: 'et-3',
        userId: 'user-1',
        tokenHash: 'used',
        type: 'VERIFY_EMAIL',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      });
      await expect(service.verifyEmail('used')).rejects.toThrow('Invalid or expired');
    });

    it('should throw on wrong token type', async () => {
      const { service, emailTokenRepo } = setup();
      emailTokenRepo.store.set('wrong-type', {
        id: 'et-4',
        userId: 'user-1',
        tokenHash: 'wrong-type',
        type: 'RESET_PASSWORD',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });
      await expect(service.verifyEmail('wrong-type')).rejects.toThrow('Invalid or expired');
    });
  });

  describe('forgotPassword', () => {
    it('should emit password reset event for existing user', async () => {
      const { service, emailTokenRepo, outbox } = setup({ users: [mockUser] });

      const result = await service.forgotPassword('a@b.com');

      expect(result.success).toBe(true);
      expect(emailTokenRepo.calls.createEmailToken).toHaveLength(1);
      expect(emailTokenRepo.calls.createEmailToken[0]?.type).toBe('RESET_PASSWORD');

      const events = outbox.events.filter((e) => e.event.type === 'user.password_reset_requested');
      expect(events).toHaveLength(1);
      const payload = events[0]?.event.payload as {
        userId: string;
        email: string;
        resetUrl: string;
      };
      expect(payload.email).toBe('a@b.com');
      expect(payload.resetUrl).toMatch(/^https:\/\/app\.test\/reset-password\?token=/);
    });

    it('should return success without emitting for non-existing user', async () => {
      const { service, emailTokenRepo, outbox } = setup();

      const result = await service.forgotPassword('nope@test.com');

      expect(result.success).toBe(true);
      expect(emailTokenRepo.calls.createEmailToken).toHaveLength(0);
      expect(outbox.events).toHaveLength(0);
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const { service, emailTokenRepo, userRepo } = setup({ users: [mockUser] });
      emailTokenRepo.store.set('reset-tok', {
        id: 'et-5',
        userId: 'user-1',
        tokenHash: 'reset-tok',
        type: 'RESET_PASSWORD',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });

      const result = await service.resetPassword('reset-tok', 'NewPassword1');

      expect(result.success).toBe(true);
      expect(userRepo.calls.updatePassword).toEqual([{ userId: 'user-1', hash: 'new-hash' }]);
    });

    it('should throw on invalid token', async () => {
      const { service } = setup();
      await expect(service.resetPassword('bad', 'NewPassword1')).rejects.toThrow(
        'Invalid or expired',
      );
    });
  });
});
