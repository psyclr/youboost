import {
  createProvider,
  findProviderById,
  findProviders,
  findActiveProvidersByPriority,
  updateProvider,
} from '../providers.repository';

const mockCreate = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    provider: {
      create: (...args: unknown[]): unknown => mockCreate(...args),
      findUnique: (...args: unknown[]): unknown => mockFindUnique(...args),
      findMany: (...args: unknown[]): unknown => mockFindMany(...args),
      count: (...args: unknown[]): unknown => mockCount(...args),
      update: (...args: unknown[]): unknown => mockUpdate(...args),
    },
  }),
}));

const mockProvider = {
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

describe('Providers Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProvider', () => {
    it('should create a provider', async () => {
      mockCreate.mockResolvedValue(mockProvider);

      const result = await createProvider({
        name: 'Test Provider',
        apiEndpoint: 'https://api.test.com/v2',
        apiKeyEncrypted: 'iv:tag:encrypted',
        priority: 10,
      });

      expect(result).toEqual(mockProvider);
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Provider',
          apiEndpoint: 'https://api.test.com/v2',
          apiKeyEncrypted: 'iv:tag:encrypted',
          priority: 10,
        }),
      });
    });

    it('should create with metadata', async () => {
      mockCreate.mockResolvedValue({ ...mockProvider, metadata: { region: 'us' } });

      await createProvider({
        name: 'Provider',
        apiEndpoint: 'https://api.test.com',
        apiKeyEncrypted: 'encrypted',
        priority: 0,
        metadata: { region: 'us' },
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { region: 'us' },
        }),
      });
    });
  });

  describe('findProviderById', () => {
    it('should find provider by id', async () => {
      mockFindUnique.mockResolvedValue(mockProvider);

      const result = await findProviderById('prov-1');

      expect(result).toEqual(mockProvider);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'prov-1' } });
    });

    it('should return null if not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await findProviderById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findProviders', () => {
    it('should return providers with pagination', async () => {
      mockFindMany.mockResolvedValue([mockProvider]);
      mockCount.mockResolvedValue(1);

      const result = await findProviders({ page: 1, limit: 20 });

      expect(result.providers).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by isActive', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findProviders({ page: 1, limit: 20, isActive: true });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('should skip based on page', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findProviders({ page: 3, limit: 10 });

      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });

    it('should not include isActive in where if undefined', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findProviders({ page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('findActiveProvidersByPriority', () => {
    it('should return active providers sorted by priority desc', async () => {
      const providers = [
        { ...mockProvider, priority: 20 },
        { ...mockProvider, id: 'prov-2', priority: 10 },
      ];
      mockFindMany.mockResolvedValue(providers);

      const result = await findActiveProvidersByPriority();

      expect(result).toHaveLength(2);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      });
    });

    it('should return empty array when no active providers', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await findActiveProvidersByPriority();

      expect(result).toHaveLength(0);
    });
  });

  describe('updateProvider', () => {
    it('should update provider name', async () => {
      mockUpdate.mockResolvedValue({ ...mockProvider, name: 'Updated' });

      const result = await updateProvider('prov-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'prov-1' },
        data: { name: 'Updated' },
      });
    });

    it('should update multiple fields', async () => {
      mockUpdate.mockResolvedValue({ ...mockProvider, priority: 99, isActive: false });

      await updateProvider('prov-1', { priority: 99, isActive: false });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'prov-1' },
        data: { priority: 99, isActive: false },
      });
    });

    it('should update apiKeyEncrypted', async () => {
      mockUpdate.mockResolvedValue({ ...mockProvider, apiKeyEncrypted: 'new-encrypted' });

      await updateProvider('prov-1', { apiKeyEncrypted: 'new-encrypted' });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'prov-1' },
        data: { apiKeyEncrypted: 'new-encrypted' },
      });
    });

    it('should not include undefined fields in update', async () => {
      mockUpdate.mockResolvedValue(mockProvider);

      await updateProvider('prov-1', { name: 'Only Name' });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'prov-1' },
        data: { name: 'Only Name' },
      });
    });
  });
});
