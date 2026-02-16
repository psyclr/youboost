import {
  createApiKey,
  findApiKeysByUserId,
  findApiKeyByHash,
  deleteApiKey,
  updateLastUsedAt,
} from '../api-keys.repository';

const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdateMany = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    apiKey: {
      create: (...args: unknown[]): unknown => mockCreate(...args),
      findMany: (...args: unknown[]): unknown => mockFindMany(...args),
      count: (...args: unknown[]): unknown => mockCount(...args),
      findUnique: (...args: unknown[]): unknown => mockFindUnique(...args),
      updateMany: (...args: unknown[]): unknown => mockUpdateMany(...args),
      update: (...args: unknown[]): unknown => mockUpdate(...args),
    },
  }),
}));

const mockRecord = {
  id: 'key-1',
  userId: 'user-1',
  keyHash: 'hash123',
  name: 'Test Key',
  permissions: null,
  rateLimitTier: 'BASIC',
  isActive: true,
  lastUsedAt: null,
  createdAt: new Date(),
  expiresAt: null,
};

describe('API Keys Repository', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createApiKey', () => {
    it('should create an API key', async () => {
      mockCreate.mockResolvedValue(mockRecord);
      const result = await createApiKey({
        userId: 'user-1',
        name: 'Test Key',
        keyHash: 'hash123',
        rateLimitTier: 'BASIC',
      });
      expect(result).toEqual(mockRecord);
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-1', name: 'Test Key', keyHash: 'hash123' }),
      });
    });

    it('should include permissions when provided', async () => {
      mockCreate.mockResolvedValue(mockRecord);
      await createApiKey({
        userId: 'user-1',
        name: 'Key',
        keyHash: 'hash',
        rateLimitTier: 'PRO',
        permissions: { read: true },
      });
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ permissions: { read: true } }),
      });
    });

    it('should include expiresAt when provided', async () => {
      const expiresAt = new Date('2027-01-01');
      mockCreate.mockResolvedValue(mockRecord);
      await createApiKey({
        userId: 'user-1',
        name: 'Key',
        keyHash: 'hash',
        rateLimitTier: 'BASIC',
        expiresAt,
      });
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ expiresAt }),
      });
    });
  });

  describe('findApiKeysByUserId', () => {
    it('should return paginated results', async () => {
      mockFindMany.mockResolvedValue([mockRecord]);
      mockCount.mockResolvedValue(1);
      const result = await findApiKeysByUserId('user-1', { page: 1, limit: 20 });
      expect(result.apiKeys).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by isActive', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      await findApiKeysByUserId('user-1', { page: 1, limit: 20, isActive: true });
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', isActive: true } }),
      );
    });

    it('should apply correct pagination offset', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      await findApiKeysByUserId('user-1', { page: 3, limit: 10 });
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });
  });

  describe('findApiKeyByHash', () => {
    it('should find key by hash with user relation', async () => {
      const withUser = { ...mockRecord, user: { role: 'USER', email: 'a@b.com' } };
      mockFindUnique.mockResolvedValue(withUser);
      const result = await findApiKeyByHash('hash123');
      expect(result).toEqual(withUser);
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { keyHash: 'hash123' },
        include: { user: { select: { role: true, email: true } } },
      });
    });

    it('should return null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await findApiKeyByHash('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('deleteApiKey', () => {
    it('should soft-delete by setting isActive to false', async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });
      await deleteApiKey('key-1', 'user-1');
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { id: 'key-1', userId: 'user-1' },
        data: { isActive: false },
      });
    });
  });

  describe('updateLastUsedAt', () => {
    it('should update lastUsedAt timestamp', async () => {
      mockUpdate.mockResolvedValue(mockRecord);
      await updateLastUsedAt('key-1');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });
});
