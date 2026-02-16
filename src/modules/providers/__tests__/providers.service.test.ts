import {
  createProvider,
  getProvider,
  listProviders,
  updateProvider,
  deactivateProvider,
} from '../providers.service';

const mockEncryptApiKey = jest.fn();

jest.mock('../utils/encryption', () => ({
  encryptApiKey: (...args: unknown[]): unknown => mockEncryptApiKey(...args),
}));

const mockCreateProvider = jest.fn();
const mockFindProviderById = jest.fn();
const mockFindProviders = jest.fn();
const mockUpdateProvider = jest.fn();

jest.mock('../providers.repository', () => ({
  createProvider: (...args: unknown[]): unknown => mockCreateProvider(...args),
  findProviderById: (...args: unknown[]): unknown => mockFindProviderById(...args),
  findProviders: (...args: unknown[]): unknown => mockFindProviders(...args),
  updateProvider: (...args: unknown[]): unknown => mockUpdateProvider(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockRecord = {
  id: 'prov-1',
  name: 'Test Provider',
  apiEndpoint: 'https://api.test.com/v2',
  apiKeyEncrypted: 'iv:tag:encrypted',
  isActive: true,
  priority: 10,
  balance: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Providers Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEncryptApiKey.mockReturnValue('iv:tag:encrypted');
  });

  describe('createProvider', () => {
    it('should encrypt API key and create provider', async () => {
      mockCreateProvider.mockResolvedValue(mockRecord);

      const result = await createProvider({
        name: 'Test Provider',
        apiEndpoint: 'https://api.test.com/v2',
        apiKey: 'raw-key',
        priority: 10,
      });

      expect(mockEncryptApiKey).toHaveBeenCalledWith('raw-key');
      expect(result.providerId).toBe('prov-1');
      expect(result.name).toBe('Test Provider');
      expect(result).not.toHaveProperty('apiKeyEncrypted');
    });

    it('should pass metadata to repository', async () => {
      mockCreateProvider.mockResolvedValue({ ...mockRecord, metadata: { x: 1 } });

      await createProvider({
        name: 'Provider',
        apiEndpoint: 'https://api.test.com',
        apiKey: 'key',
        priority: 0,
        metadata: { x: 1 },
      });

      expect(mockCreateProvider).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { x: 1 } }),
      );
    });
  });

  describe('getProvider', () => {
    it('should return provider details', async () => {
      mockFindProviderById.mockResolvedValue(mockRecord);

      const result = await getProvider('prov-1');

      expect(result.providerId).toBe('prov-1');
      expect(result.balance).toBeNull();
      expect(result.metadata).toBeNull();
    });

    it('should return balance as number when present', async () => {
      mockFindProviderById.mockResolvedValue({
        ...mockRecord,
        balance: { toNumber: () => 42.5 },
      });

      const result = await getProvider('prov-1');

      expect(result.balance).toBe(42.5);
    });

    it('should throw NotFoundError if provider not found', async () => {
      mockFindProviderById.mockResolvedValue(null);

      await expect(getProvider('nonexistent')).rejects.toThrow('Provider not found');
    });
  });

  describe('listProviders', () => {
    it('should return paginated providers', async () => {
      mockFindProviders.mockResolvedValue({ providers: [mockRecord], total: 1 });

      const result = await listProviders({ page: 1, limit: 20 });

      expect(result.providers).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should pass isActive filter', async () => {
      mockFindProviders.mockResolvedValue({ providers: [], total: 0 });

      await listProviders({ page: 1, limit: 20, isActive: true });

      expect(mockFindProviders).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
    });

    it('should calculate totalPages correctly', async () => {
      mockFindProviders.mockResolvedValue({ providers: [], total: 45 });

      const result = await listProviders({ page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('updateProvider', () => {
    it('should update provider fields', async () => {
      mockFindProviderById.mockResolvedValue(mockRecord);
      mockUpdateProvider.mockResolvedValue({ ...mockRecord, name: 'Updated' });

      const result = await updateProvider('prov-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('should re-encrypt API key when changed', async () => {
      mockFindProviderById.mockResolvedValue(mockRecord);
      mockEncryptApiKey.mockReturnValue('new-encrypted');
      mockUpdateProvider.mockResolvedValue(mockRecord);

      await updateProvider('prov-1', { apiKey: 'new-raw-key' });

      expect(mockEncryptApiKey).toHaveBeenCalledWith('new-raw-key');
      expect(mockUpdateProvider).toHaveBeenCalledWith(
        'prov-1',
        expect.objectContaining({ apiKeyEncrypted: 'new-encrypted' }),
      );
    });

    it('should throw NotFoundError if provider not found', async () => {
      mockFindProviderById.mockResolvedValue(null);

      await expect(updateProvider('nonexistent', { name: 'x' })).rejects.toThrow(
        'Provider not found',
      );
    });
  });

  describe('deactivateProvider', () => {
    it('should set isActive to false', async () => {
      mockFindProviderById.mockResolvedValue(mockRecord);
      mockUpdateProvider.mockResolvedValue({ ...mockRecord, isActive: false });

      await deactivateProvider('prov-1');

      expect(mockUpdateProvider).toHaveBeenCalledWith('prov-1', { isActive: false });
    });

    it('should throw NotFoundError if provider not found', async () => {
      mockFindProviderById.mockResolvedValue(null);

      await expect(deactivateProvider('nonexistent')).rejects.toThrow('Provider not found');
    });
  });
});
