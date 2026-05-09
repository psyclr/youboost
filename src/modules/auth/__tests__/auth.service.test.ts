import type { Prisma, PrismaClient } from '../../../generated/prisma';
import { createAuthService } from '../auth.service';
import {
  createFakeUserRepository,
  createFakeTokenRepository,
  createFakeEmailTokenRepository,
  createFakeOutbox,
  silentLogger,
} from './fakes';

jest.mock('../utils/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed'),
  comparePassword: jest.fn().mockResolvedValue(true),
}));

jest.mock('../utils/tokens', () => ({
  generateAccessToken: jest.fn().mockReturnValue('access-token'),
  generateRefreshToken: jest.fn().mockReturnValue('refresh-token'),
  hashToken: jest.fn().mockReturnValue('hashed-token'),
  getRefreshExpiresAt: jest.fn().mockReturnValue(new Date('2030-01-01')),
}));

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
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
  service: ReturnType<typeof createAuthService>;
  userRepo: ReturnType<typeof createFakeUserRepository>;
  tokenStore: ReturnType<typeof createFakeTokenRepository>;
  emailTokenRepo: ReturnType<typeof createFakeEmailTokenRepository>;
  outbox: ReturnType<typeof createFakeOutbox>;
} {
  const userRepo = createFakeUserRepository(seed);
  const tokenStore = createFakeTokenRepository();
  const emailTokenRepo = createFakeEmailTokenRepository();
  const outbox = createFakeOutbox();
  const prisma = createFakePrisma();
  const service = createAuthService({
    prisma,
    userRepo,
    tokenStore,
    emailTokenRepo,
    outbox: outbox.port,
    appUrl: 'https://app.test',
    logger: silentLogger,
  });
  return { service, userRepo, tokenStore, emailTokenRepo, outbox };
}

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const { service } = setup();
      const result = await service.register({
        email: 'test@test.com',
        password: 'Password1',
        username: 'testuser',
      });

      expect(result.email).toBe('test@test.com');
      expect(result.username).toBe('testuser');
      expect(result.userId).toMatch(/^user-/);
    });

    it('should throw ConflictError if email taken', async () => {
      const { service } = setup({ users: [mockUser] });
      await expect(
        service.register({
          email: 'test@test.com',
          password: 'Password1',
          username: 'newuser',
        }),
      ).rejects.toThrow('Email or username already taken');
    });

    it('should throw ConflictError if username taken', async () => {
      const { service } = setup({ users: [mockUser] });
      await expect(
        service.register({
          email: 'new@test.com',
          password: 'Password1',
          username: 'testuser',
        }),
      ).rejects.toThrow('Email or username already taken');
    });

    it('should emit user.email_verification_requested via outbox', async () => {
      const { service, outbox } = setup();
      await service.register({
        email: 'new@test.com',
        password: 'Password1',
        username: 'newuser',
      });

      const verificationEvents = outbox.events.filter(
        (e) => e.event.type === 'user.email_verification_requested',
      );
      expect(verificationEvents).toHaveLength(1);
      const payload = verificationEvents[0]?.event.payload as {
        userId: string;
        email: string;
        verifyUrl: string;
      };
      expect(payload.email).toBe('new@test.com');
      expect(payload.verifyUrl).toMatch(/^https:\/\/app\.test\/verify-email\?token=/);
    });

    it('should create a verification email token', async () => {
      const { service, emailTokenRepo } = setup();
      await service.register({
        email: 'new@test.com',
        password: 'Password1',
        username: 'newuser',
      });

      expect(emailTokenRepo.calls.createEmailToken).toHaveLength(1);
      expect(emailTokenRepo.calls.createEmailToken[0]?.type).toBe('VERIFY_EMAIL');
    });

    it('should emit referral.applied when referralCode provided', async () => {
      const { service, outbox } = setup();
      await service.register({
        email: 'new@test.com',
        password: 'Password1',
        username: 'newuser',
        referralCode: 'REF123',
      });

      const referralEvents = outbox.events.filter((e) => e.event.type === 'referral.applied');
      expect(referralEvents).toHaveLength(1);
      const payload = referralEvents[0]?.event.payload as {
        userId: string;
        referralCode: string;
      };
      expect(payload.referralCode).toBe('REF123');
    });

    it('should not emit referral.applied when code omitted', async () => {
      const { service, outbox } = setup();
      await service.register({
        email: 'new@test.com',
        password: 'Password1',
        username: 'newuser',
      });

      const referralEvents = outbox.events.filter((e) => e.event.type === 'referral.applied');
      expect(referralEvents).toHaveLength(0);
    });
  });

  describe('login', () => {
    it('should return token pair on valid credentials', async () => {
      const { service, tokenStore } = setup({ users: [mockUser] });
      const result = await service.login({ email: 'test@test.com', password: 'Password1' });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.tokenType).toBe('Bearer');
      expect(tokenStore.calls.saveRefreshToken).toHaveLength(1);
    });

    it('should throw UnauthorizedError if user not found', async () => {
      const { service } = setup();
      await expect(service.login({ email: 'no@test.com', password: 'x' })).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedError if account inactive', async () => {
      const { service } = setup({ users: [{ ...mockUser, status: 'SUSPENDED' }] });
      await expect(service.login({ email: 'test@test.com', password: 'x' })).rejects.toThrow(
        'Account is not active',
      );
    });

    it('should throw UnauthorizedError if password wrong', async () => {
      const { service } = setup({ users: [mockUser] });
      const { comparePassword } = jest.requireMock('../utils/password') as {
        comparePassword: jest.Mock;
      };
      comparePassword.mockResolvedValueOnce(false);
      await expect(service.login({ email: 'test@test.com', password: 'wrong' })).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('refresh', () => {
    it('should return new access token', async () => {
      const { service, tokenStore } = setup({ users: [mockUser] });
      // Seed an active refresh token
      await tokenStore.saveRefreshToken('user-1', 'hashed-token', new Date('2030-01-01'));

      const result = await service.refresh('old-refresh-token');

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(tokenStore.calls.revokeRefreshToken).toHaveLength(1);
      // saveRefreshToken called twice: initial seed + rotation
      expect(tokenStore.calls.saveRefreshToken).toHaveLength(2);
    });

    it('should throw if refresh token not found', async () => {
      const { service } = setup();
      await expect(service.refresh('bad-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should throw if user not found', async () => {
      const { service, tokenStore } = setup();
      await tokenStore.saveRefreshToken('gone', 'hashed-token', new Date('2030-01-01'));
      await expect(service.refresh('some-token')).rejects.toThrow('User not found');
    });
  });

  describe('logout', () => {
    it('should revoke tokens and blacklist access token', async () => {
      const { service, tokenStore } = setup();
      await service.logout('user-1', 'jti-123');
      expect(tokenStore.calls.revokeAllUserTokens).toEqual(['user-1']);
      expect(tokenStore.calls.blacklistAccessToken).toEqual([{ jti: 'jti-123', expiresIn: 3600 }]);
    });
  });

  describe('getMe', () => {
    it('should return user profile', async () => {
      const { service } = setup({ users: [mockUser] });
      const profile = await service.getMe('user-1');
      expect(profile.userId).toBe('user-1');
      expect(profile.email).toBe('test@test.com');
      expect(profile.username).toBe('testuser');
    });

    it('should throw NotFoundError if user not found', async () => {
      const { service } = setup();
      await expect(service.getMe('gone')).rejects.toThrow('User not found');
    });
  });

  describe('updateProfile', () => {
    it('should update username when changed', async () => {
      const { service, userRepo } = setup({ users: [mockUser] });
      await service.updateProfile('user-1', { username: 'new_name' });
      expect(userRepo.calls.updateUsername).toEqual([{ userId: 'user-1', username: 'new_name' }]);
    });

    it('should throw if username already taken', async () => {
      const other = { ...mockUser, id: 'user-2', username: 'taken' };
      const { service } = setup({ users: [mockUser, other] });
      await expect(service.updateProfile('user-1', { username: 'taken' })).rejects.toThrow(
        'Username already taken',
      );
    });

    it('should throw NotFoundError when user missing', async () => {
      const { service } = setup();
      await expect(service.updateProfile('gone', { username: 'x' })).rejects.toThrow(
        'User not found',
      );
    });

    it('should change password when current password matches', async () => {
      const { service, userRepo } = setup({ users: [mockUser] });
      await service.updateProfile('user-1', {
        currentPassword: 'Password1',
        newPassword: 'NewPassword1',
      });
      expect(userRepo.calls.updatePassword).toHaveLength(1);
    });

    it('should reject password change when current is wrong', async () => {
      const { service } = setup({ users: [mockUser] });
      const { comparePassword } = jest.requireMock('../utils/password') as {
        comparePassword: jest.Mock;
      };
      comparePassword.mockResolvedValueOnce(false);
      await expect(
        service.updateProfile('user-1', {
          currentPassword: 'wrong',
          newPassword: 'NewPassword1',
        }),
      ).rejects.toThrow('Current password is incorrect');
    });
  });
});
