import type { ProvidersRepository } from '../providers.repository';
import type { EncryptionService } from '../utils/encryption';
import type { ProviderRecord } from '../providers.types';
import type {
  ProviderClient,
  SubmitOrderParams,
  SubmitResult,
  StatusResult,
  ProviderServiceInfo,
  ProviderBalanceInfo,
} from '../../orders';

export type CreateProviderData = {
  name: string;
  apiEndpoint: string;
  apiKeyEncrypted: string;
  priority: number;
  metadata?: Record<string, unknown>;
};

export type UpdateProviderData = {
  name?: string;
  apiEndpoint?: string;
  apiKeyEncrypted?: string;
  priority?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
};

export type ProviderFilters = {
  isActive?: boolean;
  page: number;
  limit: number;
};

export type FakeProvidersRepository = ProvidersRepository & {
  calls: {
    createProvider: CreateProviderData[];
    findProviderById: string[];
    findProviders: ProviderFilters[];
    findActiveProvidersByPriority: number;
    updateProvider: Array<{ id: string; data: UpdateProviderData }>;
  };
  store: Map<string, ProviderRecord>;
};

export function createFakeProvidersRepository(
  seed: { providers?: ProviderRecord[] } = {},
): FakeProvidersRepository {
  const store = new Map<string, ProviderRecord>((seed.providers ?? []).map((p) => [p.id, p]));
  let idCounter = store.size + 1;

  const calls: FakeProvidersRepository['calls'] = {
    createProvider: [],
    findProviderById: [],
    findProviders: [],
    findActiveProvidersByPriority: 0,
    updateProvider: [],
  };

  return {
    async createProvider(data) {
      calls.createProvider.push(data);
      const id = `prov-${idCounter++}`;
      const record: ProviderRecord = {
        id,
        name: data.name,
        apiEndpoint: data.apiEndpoint,
        apiKeyEncrypted: data.apiKeyEncrypted,
        isActive: true,
        priority: data.priority,
        balance: null,
        metadata: data.metadata ?? null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };
      store.set(id, record);
      return record;
    },
    async findProviderById(id) {
      calls.findProviderById.push(id);
      return store.get(id) ?? null;
    },
    async findProviders(filters) {
      calls.findProviders.push(filters);
      const all = [...store.values()].filter((p) => {
        if (filters.isActive !== undefined && p.isActive !== filters.isActive) return false;
        return true;
      });
      const total = all.length;
      const start = (filters.page - 1) * filters.limit;
      const providers = all.slice(start, start + filters.limit);
      return { providers, total };
    },
    async findActiveProvidersByPriority() {
      calls.findActiveProvidersByPriority += 1;
      return [...store.values()].filter((p) => p.isActive).sort((a, b) => b.priority - a.priority);
    },
    async updateProvider(id, data) {
      calls.updateProvider.push({ id, data });
      const existing = store.get(id);
      if (!existing) {
        throw new Error(`Provider ${id} not found`);
      }
      const updated: ProviderRecord = {
        ...existing,
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.apiEndpoint !== undefined ? { apiEndpoint: data.apiEndpoint } : {}),
        ...(data.apiKeyEncrypted !== undefined ? { apiKeyEncrypted: data.apiKeyEncrypted } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
        updatedAt: new Date(),
      };
      store.set(id, updated);
      return updated;
    },
    calls,
    store,
  };
}

export type FakeEncryption = EncryptionService & {
  calls: {
    encryptApiKey: string[];
    decryptApiKey: string[];
  };
};

export function createFakeEncryption(): FakeEncryption {
  const calls: FakeEncryption['calls'] = {
    encryptApiKey: [],
    decryptApiKey: [],
  };
  return {
    encryptApiKey(plaintext) {
      calls.encryptApiKey.push(plaintext);
      return `enc:${plaintext}`;
    },
    decryptApiKey(encrypted) {
      calls.decryptApiKey.push(encrypted);
      return encrypted.startsWith('enc:') ? encrypted.slice(4) : encrypted;
    },
    calls,
  };
}

export type FakeSmmClient = ProviderClient & {
  calls: {
    submitOrder: SubmitOrderParams[];
    checkStatus: string[];
    fetchServices: number;
    checkBalance: number;
  };
  responses: {
    submitOrder: SubmitResult;
    checkStatus: StatusResult;
    fetchServices: ProviderServiceInfo[];
    checkBalance: ProviderBalanceInfo;
  };
};

export function createFakeSmmClient(): FakeSmmClient {
  const calls: FakeSmmClient['calls'] = {
    submitOrder: [],
    checkStatus: [],
    fetchServices: 0,
    checkBalance: 0,
  };
  const responses: FakeSmmClient['responses'] = {
    submitOrder: { externalOrderId: 'ext-1', status: 'processing' },
    checkStatus: { status: 'processing', startCount: 0, completed: 0, remains: 0 },
    fetchServices: [],
    checkBalance: { balance: 0, currency: 'USD' },
  };
  return {
    async submitOrder(params) {
      calls.submitOrder.push(params);
      return responses.submitOrder;
    },
    async checkStatus(externalOrderId) {
      calls.checkStatus.push(externalOrderId);
      return responses.checkStatus;
    },
    async fetchServices() {
      calls.fetchServices += 1;
      return responses.fetchServices;
    },
    async checkBalance() {
      calls.checkBalance += 1;
      return responses.checkBalance;
    },
    calls,
    responses,
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
