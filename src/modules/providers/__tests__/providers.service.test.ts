import { createProvidersService } from '../providers.service';
import { createFakeProvidersRepository, createFakeEncryption, silentLogger } from './fakes';
import type { ProviderRecord } from '../providers.types';

function makeRecord(overrides: Partial<ProviderRecord> = {}): ProviderRecord {
  return {
    id: 'prov-seed',
    name: 'Seed Provider',
    apiEndpoint: 'https://api.test.com/v2',
    apiKeyEncrypted: 'enc:raw-key',
    isActive: true,
    priority: 10,
    balance: null,
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('Providers Service', () => {
  describe('createProvider', () => {
    it('should encrypt API key and create provider', async () => {
      const providersRepo = createFakeProvidersRepository();
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      const result = await service.createProvider({
        name: 'Test Provider',
        apiEndpoint: 'https://api.test.com/v2',
        apiKey: 'raw-key',
        priority: 10,
      });

      expect(encryption.calls.encryptApiKey).toEqual(['raw-key']);
      expect(result.providerId).toBe('prov-1');
      expect(result.name).toBe('Test Provider');
      expect(result).not.toHaveProperty('apiKeyEncrypted');
    });

    it('should pass metadata to repository', async () => {
      const providersRepo = createFakeProvidersRepository();
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      await service.createProvider({
        name: 'Provider',
        apiEndpoint: 'https://api.test.com',
        apiKey: 'key',
        priority: 0,
        metadata: { x: 1 },
      });

      expect(providersRepo.calls.createProvider[0]).toMatchObject({ metadata: { x: 1 } });
    });
  });

  describe('getProvider', () => {
    it('should return provider details', async () => {
      const record = makeRecord({ id: 'prov-1' });
      const providersRepo = createFakeProvidersRepository({ providers: [record] });
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      const result = await service.getProvider('prov-1');

      expect(result.providerId).toBe('prov-1');
      expect(result.balance).toBeNull();
      expect(result.metadata).toBeNull();
    });

    it('should return balance as number when present', async () => {
      const record = makeRecord({
        id: 'prov-1',
        balance: { toNumber: () => 42.5 },
      });
      const providersRepo = createFakeProvidersRepository({ providers: [record] });
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      const result = await service.getProvider('prov-1');

      expect(result.balance).toBe(42.5);
    });

    it('should throw NotFoundError if provider not found', async () => {
      const providersRepo = createFakeProvidersRepository();
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      await expect(service.getProvider('nonexistent')).rejects.toThrow('Provider not found');
    });
  });

  describe('listProviders', () => {
    it('should return paginated providers', async () => {
      const record = makeRecord({ id: 'prov-1' });
      const providersRepo = createFakeProvidersRepository({ providers: [record] });
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      const result = await service.listProviders({ page: 1, limit: 20 });

      expect(result.providers).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should pass isActive filter', async () => {
      const providersRepo = createFakeProvidersRepository();
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      await service.listProviders({ page: 1, limit: 20, isActive: true });

      expect(providersRepo.calls.findProviders[0]).toMatchObject({ isActive: true });
    });

    it('should calculate totalPages correctly', async () => {
      const records = Array.from({ length: 45 }, (_, i) => makeRecord({ id: `prov-${i}` }));
      const providersRepo = createFakeProvidersRepository({ providers: records });
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      const result = await service.listProviders({ page: 1, limit: 20 });

      expect(result.pagination.total).toBe(45);
      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('updateProvider', () => {
    it('should update provider fields', async () => {
      const record = makeRecord({ id: 'prov-1', name: 'Original' });
      const providersRepo = createFakeProvidersRepository({ providers: [record] });
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      const result = await service.updateProvider('prov-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('should re-encrypt API key when changed', async () => {
      const record = makeRecord({ id: 'prov-1' });
      const providersRepo = createFakeProvidersRepository({ providers: [record] });
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      await service.updateProvider('prov-1', { apiKey: 'new-raw-key' });

      expect(encryption.calls.encryptApiKey).toEqual(['new-raw-key']);
      const updateCall = providersRepo.calls.updateProvider[0];
      expect(updateCall?.data).toMatchObject({ apiKeyEncrypted: 'enc:new-raw-key' });
    });

    it('should throw NotFoundError if provider not found', async () => {
      const providersRepo = createFakeProvidersRepository();
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      await expect(service.updateProvider('nonexistent', { name: 'x' })).rejects.toThrow(
        'Provider not found',
      );
    });
  });

  describe('deactivateProvider', () => {
    it('should set isActive to false', async () => {
      const record = makeRecord({ id: 'prov-1' });
      const providersRepo = createFakeProvidersRepository({ providers: [record] });
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      await service.deactivateProvider('prov-1');

      expect(providersRepo.calls.updateProvider).toEqual([
        { id: 'prov-1', data: { isActive: false } },
      ]);
    });

    it('should throw NotFoundError if provider not found', async () => {
      const providersRepo = createFakeProvidersRepository();
      const encryption = createFakeEncryption();
      const service = createProvidersService({ providersRepo, encryption, logger: silentLogger });

      await expect(service.deactivateProvider('nonexistent')).rejects.toThrow('Provider not found');
    });
  });
});
