import crypto from 'node:crypto';
import type { Logger } from 'pino';
import type { ApiKeysRepository } from './api-keys.repository';
import type {
  CreateApiKeyInput,
  ApiKeysQuery,
  ApiKeyResponse,
  ApiKeyRecord,
  PaginatedApiKeys,
} from './api-keys.types';

export interface ApiKeysService {
  createApiKey(
    userId: string,
    input: CreateApiKeyInput,
  ): Promise<{ apiKey: ApiKeyResponse; rawKey: string }>;
  listApiKeys(userId: string, query: ApiKeysQuery): Promise<PaginatedApiKeys>;
  revokeApiKey(userId: string, keyId: string): Promise<void>;
}

export interface ApiKeysServiceDeps {
  apiKeysRepo: ApiKeysRepository;
  logger: Logger;
}

function mapToResponse(record: ApiKeyRecord): ApiKeyResponse {
  return {
    id: record.id,
    name: record.name,
    rateLimitTier: record.rateLimitTier,
    isActive: record.isActive,
    lastUsedAt: record.lastUsedAt,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function createApiKeysService(deps: ApiKeysServiceDeps): ApiKeysService {
  const { apiKeysRepo, logger } = deps;

  async function createApiKey(
    userId: string,
    input: CreateApiKeyInput,
  ): Promise<{ apiKey: ApiKeyResponse; rawKey: string }> {
    const rawKey = `yb_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = hashApiKey(rawKey);

    const record = await apiKeysRepo.createApiKey({
      userId,
      name: input.name,
      keyHash,
      permissions: input.permissions,
      rateLimitTier: input.rateLimitTier,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    });

    logger.info({ userId, keyId: record.id }, 'API key generated');

    return { apiKey: mapToResponse(record), rawKey };
  }

  async function listApiKeys(userId: string, query: ApiKeysQuery): Promise<PaginatedApiKeys> {
    const { apiKeys, total } = await apiKeysRepo.findApiKeysByUserId(userId, {
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      page: query.page,
      limit: query.limit,
    });

    return {
      apiKeys: apiKeys.map(mapToResponse),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async function revokeApiKey(userId: string, keyId: string): Promise<void> {
    await apiKeysRepo.deleteApiKey(keyId, userId);
    logger.info({ userId, keyId }, 'API key revoked');
  }

  return { createApiKey, listApiKeys, revokeApiKey };
}
