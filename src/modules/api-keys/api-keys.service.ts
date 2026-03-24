import crypto from 'node:crypto';
import { NotFoundError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import * as repo from './api-keys.repository';
import type {
  CreateApiKeyInput,
  ApiKeysQuery,
  ApiKeyResponse,
  ApiKeyRecord,
  PaginatedApiKeys,
} from './api-keys.types';

const log = createServiceLogger('api-keys');

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

export async function generateApiKey(
  userId: string,
  input: CreateApiKeyInput,
): Promise<{ apiKey: ApiKeyResponse; rawKey: string }> {
  const rawKey = `yb_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = hashApiKey(rawKey);

  const record = await repo.createApiKey({
    userId,
    name: input.name,
    keyHash,
    permissions: input.permissions,
    rateLimitTier: input.rateLimitTier,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  });

  log.info({ userId, keyId: record.id }, 'API key generated');

  return { apiKey: mapToResponse(record), rawKey };
}

export async function listApiKeys(userId: string, query: ApiKeysQuery): Promise<PaginatedApiKeys> {
  const { apiKeys, total } = await repo.findApiKeysByUserId(userId, {
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

export async function revokeApiKey(userId: string, keyId: string): Promise<void> {
  await repo.deleteApiKey(keyId, userId);
  log.info({ userId, keyId }, 'API key revoked');
}

export async function findByHash(
  keyHash: string,
): Promise<(ApiKeyRecord & { user?: { role: string; email: string } }) | null> {
  return repo.findApiKeyByHash(keyHash);
}

export async function getApiKeyByHash(keyHash: string): Promise<ApiKeyRecord> {
  const record = await repo.findApiKeyByHash(keyHash);
  if (!record) {
    throw new NotFoundError('API key not found', 'API_KEY_NOT_FOUND');
  }
  return record;
}
