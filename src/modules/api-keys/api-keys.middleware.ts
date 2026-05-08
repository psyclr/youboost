import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Logger } from 'pino';
import type Redis from 'ioredis';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors';
import type { AppConfig } from '../../shared/config';
import { fireAndForget } from '../../shared/utils/fire-and-forget';
import { hashApiKey } from './api-keys.service';
import type { ApiKeysRepository } from './api-keys.repository';

export interface ApiKeyAuthMiddlewareDeps {
  apiKeysRepo: ApiKeysRepository;
  redis: Redis;
  config: AppConfig;
  logger: Logger;
}

function getRateLimit(config: AppConfig, tier: string): number {
  switch (tier) {
    case 'PRO':
      return config.apiKeys.ratePro;
    case 'ENTERPRISE':
      return config.apiKeys.rateEnterprise;
    default:
      return config.apiKeys.rateBasic;
  }
}

export function createApiKeyAuthMiddleware(
  deps: ApiKeyAuthMiddlewareDeps,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const { apiKeysRepo, redis, config, logger } = deps;

  return async (request, _reply) => {
    const apiKeyHeader = request.headers['x-api-key'];
    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      throw new UnauthorizedError('Missing X-API-Key header', 'MISSING_API_KEY');
    }

    const keyHash = hashApiKey(apiKeyHeader);
    const record = await apiKeysRepo.findApiKeyByHash(keyHash);

    if (!record) {
      throw new UnauthorizedError('Invalid API key', 'INVALID_API_KEY');
    }

    if (!record.isActive) {
      throw new UnauthorizedError('API key has been revoked', 'API_KEY_REVOKED');
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      throw new UnauthorizedError('API key has expired', 'API_KEY_EXPIRED');
    }

    const rateLimit = getRateLimit(config, record.rateLimitTier);
    const redisKey = `ratelimit:apikey:${record.id}`;
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

    fireAndForget(apiKeysRepo.updateLastUsedAt(record.id), {
      operation: 'updateLastUsedAt',
      logger,
      extra: { keyId: record.id },
    });
  };
}
