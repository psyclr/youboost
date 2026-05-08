import { createProviderSelector } from '../provider-selector';
import {
  createFakeProvidersRepository,
  createFakeEncryption,
  createFakeSmmClient,
  silentLogger,
} from './fakes';
import type { ProviderRecord } from '../providers.types';
import type { ProviderClient } from '../../orders';

function makeRecord(overrides: Partial<ProviderRecord> = {}): ProviderRecord {
  return {
    id: 'prov-seed',
    name: 'Seed Provider',
    apiEndpoint: 'https://api.provider.com',
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

function makeDeps(opts: {
  providerMode: 'stub' | 'real';
  providers?: ProviderRecord[];
  stubClient?: ProviderClient;
}): {
  providersRepo: ReturnType<typeof createFakeProvidersRepository>;
  encryption: ReturnType<typeof createFakeEncryption>;
  stubClient: ProviderClient;
} {
  const providersRepo = createFakeProvidersRepository({ providers: opts.providers ?? [] });
  const encryption = createFakeEncryption();
  const stubClient = opts.stubClient ?? createFakeSmmClient();
  return { providersRepo, encryption, stubClient };
}

describe('Provider Selector', () => {
  describe('selectProvider', () => {
    it('should return stub client when mode is stub', async () => {
      const stubClient = createFakeSmmClient();
      const { providersRepo, encryption } = makeDeps({ providerMode: 'stub', stubClient });
      const selector = createProviderSelector({
        providersRepo,
        encryption,
        stubClient,
        providerMode: 'stub',
        logger: silentLogger,
      });

      const result = await selector.selectProvider();

      expect(result.providerId).toBeNull();
      expect(result.client).toBe(stubClient);
      expect(providersRepo.calls.findActiveProvidersByPriority).toBe(0);
    });

    it('should return real provider when mode is real and providers exist', async () => {
      const provider = makeRecord({
        id: 'prov-1',
        apiEndpoint: 'https://api.provider.com',
        apiKeyEncrypted: 'enc:decrypted-key',
        priority: 10,
      });
      const { providersRepo, encryption, stubClient } = makeDeps({
        providerMode: 'real',
        providers: [provider],
      });
      const selector = createProviderSelector({
        providersRepo,
        encryption,
        stubClient,
        providerMode: 'real',
        logger: silentLogger,
      });

      const result = await selector.selectProvider();

      expect(result.providerId).toBe('prov-1');
      expect(result.client).not.toBe(stubClient);
      expect(encryption.calls.decryptApiKey).toEqual(['enc:decrypted-key']);
    });

    it('should pick highest priority provider', async () => {
      const high = makeRecord({ id: 'prov-high', priority: 20 });
      const low = makeRecord({ id: 'prov-low', priority: 5 });
      const { providersRepo, encryption, stubClient } = makeDeps({
        providerMode: 'real',
        providers: [low, high],
      });
      const selector = createProviderSelector({
        providersRepo,
        encryption,
        stubClient,
        providerMode: 'real',
        logger: silentLogger,
      });

      const result = await selector.selectProvider();

      expect(result.providerId).toBe('prov-high');
    });

    it('should fallback to stub when mode is real but no active providers', async () => {
      const stubClient = createFakeSmmClient();
      const { providersRepo, encryption } = makeDeps({ providerMode: 'real', stubClient });
      const selector = createProviderSelector({
        providersRepo,
        encryption,
        stubClient,
        providerMode: 'real',
        logger: silentLogger,
      });

      const result = await selector.selectProvider();

      expect(result.providerId).toBeNull();
      expect(result.client).toBe(stubClient);
    });

    it('should call findActiveProvidersByPriority when mode is real', async () => {
      const { providersRepo, encryption, stubClient } = makeDeps({ providerMode: 'real' });
      const selector = createProviderSelector({
        providersRepo,
        encryption,
        stubClient,
        providerMode: 'real',
        logger: silentLogger,
      });

      await selector.selectProvider();

      expect(providersRepo.calls.findActiveProvidersByPriority).toBe(1);
    });

    it('should return a client with submitOrder and checkStatus', async () => {
      const { providersRepo, encryption, stubClient } = makeDeps({ providerMode: 'stub' });
      const selector = createProviderSelector({
        providersRepo,
        encryption,
        stubClient,
        providerMode: 'stub',
        logger: silentLogger,
      });

      const result = await selector.selectProvider();

      expect(typeof result.client.submitOrder).toBe('function');
      expect(typeof result.client.checkStatus).toBe('function');
    });
  });

  describe('selectProviderById', () => {
    it('should return stub client when mode is stub', async () => {
      const stubClient = createFakeSmmClient();
      const { providersRepo, encryption } = makeDeps({ providerMode: 'stub', stubClient });
      const selector = createProviderSelector({
        providersRepo,
        encryption,
        stubClient,
        providerMode: 'stub',
        logger: silentLogger,
      });

      const result = await selector.selectProviderById('prov-1');

      expect(result.providerId).toBeNull();
      expect(result.client).toBe(stubClient);
      expect(providersRepo.calls.findProviderById).toHaveLength(0);
    });

    it('should return provider by ID when mode is real', async () => {
      const provider = makeRecord({
        id: 'prov-1',
        apiKeyEncrypted: 'enc:decrypted-key',
      });
      const { providersRepo, encryption, stubClient } = makeDeps({
        providerMode: 'real',
        providers: [provider],
      });
      const selector = createProviderSelector({
        providersRepo,
        encryption,
        stubClient,
        providerMode: 'real',
        logger: silentLogger,
      });

      const result = await selector.selectProviderById('prov-1');

      expect(result.providerId).toBe('prov-1');
      expect(result.client).not.toBe(stubClient);
      expect(providersRepo.calls.findProviderById).toEqual(['prov-1']);
    });

    it('should throw when provider not found', async () => {
      const { providersRepo, encryption, stubClient } = makeDeps({ providerMode: 'real' });
      const selector = createProviderSelector({
        providersRepo,
        encryption,
        stubClient,
        providerMode: 'real',
        logger: silentLogger,
      });

      await expect(selector.selectProviderById('bad-id')).rejects.toThrow(
        'Linked provider is not available',
      );
    });

    it('should throw when provider is inactive', async () => {
      const provider = makeRecord({ id: 'prov-1', isActive: false });
      const { providersRepo, encryption, stubClient } = makeDeps({
        providerMode: 'real',
        providers: [provider],
      });
      const selector = createProviderSelector({
        providersRepo,
        encryption,
        stubClient,
        providerMode: 'real',
        logger: silentLogger,
      });

      await expect(selector.selectProviderById('prov-1')).rejects.toThrow(
        'Linked provider is not available',
      );
    });
  });
});
