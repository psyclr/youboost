import type { ApiKeysRepository } from '../api-keys.repository';
import type { ApiKeyRecord } from '../api-keys.types';

export type CreateApiKeyData = {
  userId: string;
  name: string;
  keyHash: string;
  permissions?: unknown;
  rateLimitTier: string;
  expiresAt?: Date;
};

export type ApiKeyFilters = {
  isActive?: boolean;
  page: number;
  limit: number;
};

type SeededApiKeyRecord = ApiKeyRecord & { user?: { role: string; email: string } };

export type FakeApiKeysRepository = ApiKeysRepository & {
  calls: {
    createApiKey: CreateApiKeyData[];
    findApiKeysByUserId: Array<{ userId: string; filters: ApiKeyFilters }>;
    findApiKeyByHash: string[];
    deleteApiKey: Array<{ keyId: string; userId: string }>;
    updateLastUsedAt: string[];
  };
  store: Map<string, SeededApiKeyRecord>;
  setUpdateLastUsedAtFailure: (err: Error | null) => void;
};

export function createFakeApiKeysRepository(
  seed: { keys?: SeededApiKeyRecord[] } = {},
): FakeApiKeysRepository {
  const store = new Map<string, SeededApiKeyRecord>((seed.keys ?? []).map((k) => [k.id, k]));
  let idCounter = store.size + 1;

  const calls: FakeApiKeysRepository['calls'] = {
    createApiKey: [],
    findApiKeysByUserId: [],
    findApiKeyByHash: [],
    deleteApiKey: [],
    updateLastUsedAt: [],
  };

  let updateLastUsedAtFailure: Error | null = null;

  return {
    async createApiKey(data) {
      calls.createApiKey.push(data);
      const id = `key-${idCounter++}`;
      const record: SeededApiKeyRecord = {
        id,
        userId: data.userId,
        keyHash: data.keyHash,
        name: data.name,
        permissions: data.permissions ?? null,
        rateLimitTier: data.rateLimitTier,
        isActive: true,
        lastUsedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        expiresAt: data.expiresAt ?? null,
      };
      store.set(id, record);
      return record;
    },
    async findApiKeysByUserId(userId, filters) {
      calls.findApiKeysByUserId.push({ userId, filters });
      const all = [...store.values()].filter((k) => {
        if (k.userId !== userId) return false;
        if (filters.isActive !== undefined && k.isActive !== filters.isActive) return false;
        return true;
      });
      const total = all.length;
      const start = (filters.page - 1) * filters.limit;
      const apiKeys = all.slice(start, start + filters.limit);
      return { apiKeys, total };
    },
    async findApiKeyByHash(keyHash) {
      calls.findApiKeyByHash.push(keyHash);
      const found = [...store.values()].find((k) => k.keyHash === keyHash);
      if (!found) return null;
      return {
        ...found,
        user: found.user ?? { role: 'USER', email: 'user@example.com' },
      };
    },
    async deleteApiKey(keyId, userId) {
      calls.deleteApiKey.push({ keyId, userId });
      const existing = store.get(keyId);
      if (!existing || existing.userId !== userId) return;
      store.set(keyId, { ...existing, isActive: false });
    },
    async updateLastUsedAt(keyId) {
      calls.updateLastUsedAt.push(keyId);
      if (updateLastUsedAtFailure) throw updateLastUsedAtFailure;
      const existing = store.get(keyId);
      if (!existing) return;
      store.set(keyId, { ...existing, lastUsedAt: new Date() });
    },
    calls,
    store,
    setUpdateLastUsedAtFailure(err) {
      updateLastUsedAtFailure = err;
    },
  };
}

export const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  trace: () => undefined,
  child: () => silentLogger,
  level: 'silent',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
