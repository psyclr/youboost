import { createAuthEmailService } from '../auth-email.service';
import {
  createFakeUserRepository,
  createFakeEmailTokenRepository,
  createFakeEmailProvider,
  silentLogger,
} from './fakes';

jest.mock('../utils/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('new-hash'),
}));

jest.mock('../utils/tokens', () => ({
  hashToken: (input: string): string => input, // identity hash so tests can control storage keys
}));

jest.mock('../../notifications', () => ({
  verificationEmail: jest.fn().mockReturnValue({ subject: 'Verify', body: '<html>verify</html>' }),
  passwordResetEmail: jest.fn().mockReturnValue({ subject: 'Reset', body: '<html>reset</html>' }),
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

function setup(seed: { users?: Array<typeof mockUser> } = {}): {
  service: ReturnType<typeof createAuthEmailService>;
  userRepo: ReturnType<typeof createFakeUserRepository>;
  emailTokenRepo: ReturnType<typeof createFakeEmailTokenRepository>;
  emailProvider: ReturnType<typeof createFakeEmailProvider>;
} {
  const userRepo = createFakeUserRepository(seed);
  const emailTokenRepo = createFakeEmailTokenRepository();
  const emailProvider = createFakeEmailProvider();
  const service = createAuthEmailService({
    userRepo,
    emailTokenRepo,
    emailProvider,
    appUrl: 'https://app.test',
    logger: silentLogger,
  });
  return { service, userRepo, emailTokenRepo, emailProvider };
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
    it('should send reset email for existing user', async () => {
      const { service, emailTokenRepo, emailProvider } = setup({ users: [mockUser] });

      const result = await service.forgotPassword('a@b.com');

      expect(result.success).toBe(true);
      expect(emailTokenRepo.calls.createEmailToken).toHaveLength(1);
      expect(emailProvider.sent).toHaveLength(1);
      expect(emailProvider.sent[0]?.to).toBe('a@b.com');
      expect(emailProvider.sent[0]?.subject).toBe('Reset');
    });

    it('should return success even for non-existing user', async () => {
      const { service, emailTokenRepo, emailProvider } = setup();

      const result = await service.forgotPassword('nope@test.com');

      expect(result.success).toBe(true);
      expect(emailTokenRepo.calls.createEmailToken).toHaveLength(0);
      expect(emailProvider.sent).toHaveLength(0);
    });

    it('should swallow email provider errors and still return success', async () => {
      const { service, emailProvider } = setup({ users: [mockUser] });
      emailProvider.setFailure(new Error('SMTP down'));
      const result = await service.forgotPassword('a@b.com');
      expect(result.success).toBe(true);
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

  describe('sendVerificationEmail', () => {
    it('should create a token and send an email', async () => {
      const { service, emailTokenRepo, emailProvider } = setup();
      await service.sendVerificationEmail('user-1', 'a@b.com');
      expect(emailTokenRepo.calls.createEmailToken).toHaveLength(1);
      expect(emailTokenRepo.calls.createEmailToken[0]?.type).toBe('VERIFY_EMAIL');
      expect(emailProvider.sent).toHaveLength(1);
      expect(emailProvider.sent[0]?.to).toBe('a@b.com');
    });

    it('should swallow provider errors', async () => {
      const { service, emailProvider } = setup();
      emailProvider.setFailure(new Error('SMTP down'));
      await expect(service.sendVerificationEmail('user-1', 'a@b.com')).resolves.toBeUndefined();
    });
  });
});
