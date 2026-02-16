import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getConfig } from '../../../shared/config';
import type { AuthenticatedUser } from '../auth.types';

interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  const config = getConfig();
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AuthenticatedUser {
  const config = getConfig();
  const decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
  return {
    userId: decoded['userId'] as string,
    email: decoded['email'] as string,
    role: decoded['role'] as string,
    jti: decoded['jti'] as string,
  };
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateEmailToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getRefreshExpiresAt(): Date {
  const config = getConfig();
  const match = /^(\d+)([dhms])$/.exec(config.jwt.refreshExpiresIn);
  if (!match) {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  const value = Number.parseInt(match[1] ?? '30', 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const ms = value * (multipliers[unit ?? 'd'] ?? 24 * 60 * 60 * 1000);
  return new Date(Date.now() + ms);
}
