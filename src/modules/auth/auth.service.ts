import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors';
import type { OutboxPort } from '../../shared/outbox';
import { hashPassword, comparePassword } from './utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshExpiresAt,
} from './utils/tokens';
import type { UserRepository } from './user.repository';
import type { TokenRepository } from './token.repository';
import type { EmailTokenRepository } from './email-token.repository';
import type {
  RegisterInput,
  LoginInput,
  TokenPair,
  UserProfile,
  UpdateProfileInput,
} from './auth.types';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

import type { AuthAutoUserService, AutoUserTicket } from './auth-auto-user.service';

export type { AutoUserTicket } from './auth-auto-user.service';

export interface AuthService {
  register(input: RegisterInput): Promise<{ userId: string; email: string; username: string }>;
  login(input: LoginInput): Promise<TokenPair>;
  refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>;
  logout(userId: string, jti: string): Promise<void>;
  getMe(userId: string): Promise<UserProfile>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile>;
  createAutoUser(email: string): Promise<AutoUserTicket>;
  setPasswordViaAutoUserToken(rawToken: string, newPassword: string): Promise<{ userId: string }>;
}

export interface AuthServiceDeps {
  prisma: PrismaClient;
  userRepo: UserRepository;
  tokenStore: TokenRepository;
  emailTokenRepo: EmailTokenRepository;
  outbox: OutboxPort;
  autoUser: AuthAutoUserService;
  appUrl: string;
  logger: Logger;
}

export function createAuthService(deps: AuthServiceDeps): AuthService {
  const { prisma, userRepo, tokenStore, emailTokenRepo, outbox, autoUser, appUrl, logger } = deps;

  async function register(
    input: RegisterInput,
  ): Promise<{ userId: string; email: string; username: string }> {
    const existingEmail = await userRepo.findByEmail(input.email);
    const existingUsername = await userRepo.findByUsername(input.username);

    if (existingEmail || existingUsername) {
      throw new ConflictError('Email or username already taken', 'REGISTRATION_CONFLICT');
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await userRepo.createUser(
        {
          email: input.email,
          username: input.username,
          passwordHash,
        },
        tx,
      );

      const verifyToken = await emailTokenRepo.createEmailToken({
        userId: created.id,
        type: 'VERIFY_EMAIL',
        ttlMs: VERIFICATION_TOKEN_TTL_MS,
        tx,
      });
      const verifyUrl = `${appUrl}/verify-email?token=${verifyToken}`;

      await outbox.emit(
        {
          type: 'user.email_verification_requested',
          aggregateType: 'user',
          aggregateId: created.id,
          userId: created.id,
          payload: { userId: created.id, email: created.email, verifyUrl },
        },
        tx,
      );

      if (input.referralCode) {
        await outbox.emit(
          {
            type: 'referral.applied',
            aggregateType: 'user',
            aggregateId: created.id,
            userId: created.id,
            payload: { userId: created.id, referralCode: input.referralCode },
          },
          tx,
        );
      }

      return created;
    });

    logger.info({ userId: user.id }, 'User registered');

    return { userId: user.id, email: user.email, username: user.username };
  }

  async function login(input: LoginInput): Promise<TokenPair> {
    const user = await userRepo.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active', 'ACCOUNT_INACTIVE');
    }

    const valid = await comparePassword(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken();
    const refreshHash = hashToken(refreshToken);
    const expiresAt = getRefreshExpiresAt();
    await tokenStore.saveRefreshToken(user.id, refreshHash, expiresAt);

    logger.info({ userId: user.id }, 'User logged in');
    return { accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer' };
  }

  async function refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const tokenHash = hashToken(refreshToken);
    const stored = await tokenStore.findRefreshToken(tokenHash);
    if (!stored) {
      throw new UnauthorizedError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    await tokenStore.revokeRefreshToken(tokenHash);

    const user = await userRepo.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedError('User not found', 'USER_NOT_FOUND');
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const newRefreshToken = generateRefreshToken();
    const newHash = hashToken(newRefreshToken);
    const expiresAt = getRefreshExpiresAt();
    await tokenStore.saveRefreshToken(user.id, newHash, expiresAt);

    return { accessToken, refreshToken: newRefreshToken, expiresIn: 3600 };
  }

  async function logout(userId: string, jti: string): Promise<void> {
    await tokenStore.revokeAllUserTokens(userId);
    await tokenStore.blacklistAccessToken(jti, 3600);
    logger.info({ userId }, 'User logged out');
  }

  async function getMe(userId: string): Promise<UserProfile> {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }
    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  async function updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (input.username && input.username !== user.username) {
      const existing = await userRepo.findByUsername(input.username);
      if (existing) {
        throw new ConflictError('Username already taken', 'USERNAME_TAKEN');
      }
    }

    if (input.currentPassword && input.newPassword) {
      const valid = await comparePassword(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new ValidationError('Current password is incorrect', 'INVALID_PASSWORD');
      }
      const newHash = await hashPassword(input.newPassword);
      await userRepo.updatePassword(userId, newHash);
    }

    if (input.username && input.username !== user.username) {
      await userRepo.updateUsername(userId, input.username);
    }

    return getMe(userId);
  }

  return {
    register,
    login,
    refresh,
    logout,
    getMe,
    updateProfile,
    createAutoUser: autoUser.createAutoUser,
    setPasswordViaAutoUserToken: autoUser.setPasswordViaAutoUserToken,
  };
}
