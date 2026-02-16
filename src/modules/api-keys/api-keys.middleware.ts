import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors';
import { getRedis } from '../../shared/redis/redis';
import { getConfig } from '../../shared/config/env';
import { createServiceLogger } from '../../shared/utils/logger';
import { hashApiKey } from './api-keys.service';
import * as repo from './api-keys.repository';

const log = createServiceLogger('api-key-auth');

function getRateLimit(tier: string): number {
  const config = getConfig();
  switch (tier) {
    case 'PRO':
      return config.apiKeys.ratePro;
    case 'ENTERPRISE':
      return config.apiKeys.rateEnterprise;
    default:
      return config.apiKeys.rateBasic;
  }
}

export async function authenticateApiKey(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const apiKeyHeader = request.headers['x-api-key'];
  if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
    throw new UnauthorizedError('Missing X-API-Key header', 'MISSING_API_KEY');
  }

  const keyHash = hashApiKey(apiKeyHeader);
  const record = await repo.findApiKeyByHash(keyHash);

  if (!record) {
    throw new UnauthorizedError('Invalid API key', 'INVALID_API_KEY');
  }

  if (!record.isActive) {
    throw new UnauthorizedError('API key has been revoked', 'API_KEY_REVOKED');
  }

  if (record.expiresAt && record.expiresAt < new Date()) {
    throw new UnauthorizedError('API key has expired', 'API_KEY_EXPIRED');
  }

  const rateLimit = getRateLimit(record.rateLimitTier);
  const redisKey = `ratelimit:apikey:${record.id}`;
  const redis = getRedis();
  const current = await redis.incr(redisKey);
  if (current === 1) {
    await redis.expire(redisKey, 60);
  }

  if (current > rateLimit) {
    throw new ForbiddenError(
      `Rate limit exceeded (${rateLimit} requests per minute)`,
      'RATE_LIMIT_EXCEEDED',
    );
  }

  request.user = {
    userId: record.userId,
    email: record.user.email,
    role: record.user.role,
    jti: record.id,
  };

  // Fire-and-forget lastUsedAt update
  repo.updateLastUsedAt(record.id).catch((err) => {
    log.error({ err, keyId: record.id }, 'Failed to update lastUsedAt');
  });
}
