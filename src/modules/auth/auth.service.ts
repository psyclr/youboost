import { ConflictError, UnauthorizedError, NotFoundError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { hashPassword, comparePassword } from './utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshExpiresAt,
} from './utils/tokens';
import * as userRepo from './user.repository';
import * as tokenStore from './token-store';
import type { RegisterInput, LoginInput, TokenPair, UserProfile } from './auth.types';

const log = createServiceLogger('auth');

export async function register(
  input: RegisterInput,
): Promise<{ userId: string; email: string; username: string }> {
  const existingEmail = await userRepo.findByEmail(input.email);
  if (existingEmail) {
    throw new ConflictError('Email already registered', 'EMAIL_TAKEN');
  }

  const existingUsername = await userRepo.findByUsername(input.username);
  if (existingUsername) {
    throw new ConflictError('Username already taken', 'USERNAME_TAKEN');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await userRepo.createUser({
    email: input.email,
    username: input.username,
    passwordHash,
  });

  log.info({ userId: user.id }, 'User registered');
  return { userId: user.id, email: user.email, username: user.username };
}

export async function login(input: LoginInput): Promise<TokenPair> {
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

  log.info({ userId: user.id }, 'User logged in');
  return { accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer' };
}

export async function refresh(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
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

  return { accessToken, expiresIn: 3600 };
}

export async function logout(userId: string, jti: string): Promise<void> {
  await tokenStore.revokeAllUserTokens(userId);
  await tokenStore.blacklistAccessToken(jti, 3600);
  log.info({ userId }, 'User logged out');
}

export async function getMe(userId: string): Promise<UserProfile> {
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
