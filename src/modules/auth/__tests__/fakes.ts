import type { Prisma } from '../../../generated/prisma';
import type { OutboxPort, OutboxEvent } from '../../../shared/outbox';
import type { UserRepository } from '../user.repository';
import type { TokenRepository } from '../token.repository';
import type { EmailTokenRepository, EmailTokenType } from '../email-token.repository';

type UserRecord = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type FakeUserRepository = UserRepository & {
  store: Map<string, UserRecord>;
  calls: {
    findByEmail: string[];
    findByUsername: string[];
    findById: string[];
    createUser: Array<{ email: string; username: string; passwordHash: string }>;
    setEmailVerified: string[];
    updatePassword: Array<{ userId: string; hash: string }>;
    updateUsername: Array<{ userId: string; username: string }>;
    findAllUsers: Array<{
      role?: string | undefined;
      status?: string | undefined;
      page: number;
      limit: number;
    }>;
    updateUserRole: Array<{ userId: string; role: string }>;
    updateUserStatus: Array<{ userId: string; status: string }>;
  };
};

export function createFakeUserRepository(seed: { users?: UserRecord[] } = {}): FakeUserRepository {
  const store = new Map<string, UserRecord>((seed.users ?? []).map((u) => [u.id, u]));
  let idCounter = store.size + 1;

  const calls: FakeUserRepository['calls'] = {
    findByEmail: [],
    findByUsername: [],
    findById: [],
    createUser: [],
    setEmailVerified: [],
    updatePassword: [],
    updateUsername: [],
    findAllUsers: [],
    updateUserRole: [],
    updateUserStatus: [],
  };

  return {
    async findByEmail(email) {
      calls.findByEmail.push(email);
      return [...store.values()].find((u) => u.email === email) ?? null;
    },
    async findByUsername(username) {
      calls.findByUsername.push(username);
      return [...store.values()].find((u) => u.username === username) ?? null;
    },
    async findById(id) {
      calls.findById.push(id);
      return store.get(id) ?? null;
    },
    async createUser(data, _tx) {
      calls.createUser.push(data);
      const id = `user-${idCounter++}`;
      const record: UserRecord = {
        id,
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash,
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };
      store.set(id, record);
      return record;
    },
    async setEmailVerified(userId) {
      calls.setEmailVerified.push(userId);
      const existing = store.get(userId);
      if (existing) store.set(userId, { ...existing, emailVerified: true });
    },
    async updatePassword(userId, hash) {
      calls.updatePassword.push({ userId, hash });
      const existing = store.get(userId);
      if (existing) store.set(userId, { ...existing, passwordHash: hash });
    },
    async updateUsername(userId, username) {
      calls.updateUsername.push({ userId, username });
      const existing = store.get(userId);
      if (existing) store.set(userId, { ...existing, username });
    },
    async findAllUsers(filters) {
      calls.findAllUsers.push(filters);
      const all = [...store.values()].filter((u) => {
        if (filters.role && u.role !== filters.role) return false;
        if (filters.status && u.status !== filters.status) return false;
        return true;
      });
      const total = all.length;
      const start = (filters.page - 1) * filters.limit;
      const users = all.slice(start, start + filters.limit);
      return { users, total };
    },
    async updateUserRole(userId, role) {
      calls.updateUserRole.push({ userId, role });
      const existing = store.get(userId);
      if (!existing) throw new Error(`User ${userId} not found`);
      const updated = { ...existing, role };
      store.set(userId, updated);
      return updated;
    },
    async updateUserStatus(userId, status) {
      calls.updateUserStatus.push({ userId, status });
      const existing = store.get(userId);
      if (!existing) throw new Error(`User ${userId} not found`);
      const updated = { ...existing, status };
      store.set(userId, updated);
      return updated;
    },
    store,
    calls,
  };
}

type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export type FakeTokenRepository = TokenRepository & {
  refreshStore: Map<string, RefreshTokenRecord>;
  blacklist: Set<string>;
  calls: {
    saveRefreshToken: Array<{ userId: string; tokenHash: string; expiresAt: Date }>;
    findRefreshToken: string[];
    revokeRefreshToken: string[];
    revokeAllUserTokens: string[];
    blacklistAccessToken: Array<{ jti: string; expiresIn: number }>;
    isAccessTokenBlacklisted: string[];
  };
};

export function createFakeTokenRepository(): FakeTokenRepository {
  const refreshStore = new Map<string, RefreshTokenRecord>();
  const blacklist = new Set<string>();
  let idCounter = 1;

  const calls: FakeTokenRepository['calls'] = {
    saveRefreshToken: [],
    findRefreshToken: [],
    revokeRefreshToken: [],
    revokeAllUserTokens: [],
    blacklistAccessToken: [],
    isAccessTokenBlacklisted: [],
  };

  return {
    async saveRefreshToken(userId, tokenHash, expiresAt) {
      calls.saveRefreshToken.push({ userId, tokenHash, expiresAt });
      const id = `rt-${idCounter++}`;
      refreshStore.set(tokenHash, {
        id,
        userId,
        tokenHash,
        expiresAt,
        revokedAt: null,
        createdAt: new Date(),
      });
    },
    async findRefreshToken(tokenHash) {
      calls.findRefreshToken.push(tokenHash);
      const found = refreshStore.get(tokenHash);
      if (!found) return null;
      if (found.revokedAt !== null) return null;
      if (found.expiresAt <= new Date()) return null;
      return found;
    },
    async revokeRefreshToken(tokenHash) {
      calls.revokeRefreshToken.push(tokenHash);
      const found = refreshStore.get(tokenHash);
      if (found) refreshStore.set(tokenHash, { ...found, revokedAt: new Date() });
    },
    async revokeAllUserTokens(userId) {
      calls.revokeAllUserTokens.push(userId);
      for (const [key, value] of refreshStore) {
        if (value.userId === userId && value.revokedAt === null) {
          refreshStore.set(key, { ...value, revokedAt: new Date() });
        }
      }
    },
    async blacklistAccessToken(jti, expiresIn) {
      calls.blacklistAccessToken.push({ jti, expiresIn });
      blacklist.add(jti);
    },
    async isAccessTokenBlacklisted(jti) {
      calls.isAccessTokenBlacklisted.push(jti);
      return blacklist.has(jti);
    },
    refreshStore,
    blacklist,
    calls,
  };
}

type EmailTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  type: EmailTokenType;
  expiresAt: Date;
  usedAt: Date | null;
};

export type FakeEmailTokenRepository = EmailTokenRepository & {
  store: Map<string, EmailTokenRecord>;
  calls: {
    createEmailToken: Array<{ userId: string; type: EmailTokenType; ttlMs: number }>;
    findEmailTokenByHash: string[];
    markEmailTokenUsed: string[];
  };
  nextToken: (token: string) => void;
};

export function createFakeEmailTokenRepository(): FakeEmailTokenRepository {
  const store = new Map<string, EmailTokenRecord>();
  let idCounter = 1;
  let overrideToken: string | null = null;

  const calls: FakeEmailTokenRepository['calls'] = {
    createEmailToken: [],
    findEmailTokenByHash: [],
    markEmailTokenUsed: [],
  };

  return {
    async createEmailToken(params) {
      const { userId, type, ttlMs } = params;
      calls.createEmailToken.push({ userId, type, ttlMs });
      const token = overrideToken ?? `token-${idCounter}`;
      // In real impl, the DB stores the hashed token. Here we store by token value
      // for simplicity; tests use the hash via `findEmailTokenByHash` with the real
      // hashToken() helper, so seed-insert helpers can match accordingly.
      const id = `et-${idCounter++}`;
      overrideToken = null;
      store.set(token, {
        id,
        userId,
        tokenHash: token,
        type,
        expiresAt: new Date(Date.now() + ttlMs),
        usedAt: null,
      });
      return token;
    },
    async findEmailTokenByHash(tokenHash) {
      calls.findEmailTokenByHash.push(tokenHash);
      return store.get(tokenHash) ?? null;
    },
    async markEmailTokenUsed(tokenId) {
      calls.markEmailTokenUsed.push(tokenId);
      for (const [key, value] of store) {
        if (value.id === tokenId) {
          store.set(key, { ...value, usedAt: new Date() });
        }
      }
    },
    store,
    calls,
    nextToken(token) {
      overrideToken = token;
    },
  };
}

export interface FakeOutbox {
  port: OutboxPort;
  events: { event: OutboxEvent; tx: Prisma.TransactionClient }[];
}

export function createFakeOutbox(): FakeOutbox {
  const events: { event: OutboxEvent; tx: Prisma.TransactionClient }[] = [];
  return {
    port: {
      async emit(event, tx): Promise<void> {
        events.push({ event, tx });
      },
    },
    events,
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
