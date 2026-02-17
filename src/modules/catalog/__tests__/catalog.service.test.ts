import { listServices, getService } from '../catalog.service';

const mockFindActiveServices = jest.fn();
const mockFindActiveServiceById = jest.fn();

jest.mock('../catalog.repository', () => ({
  findActiveServices: (...args: unknown[]): unknown => mockFindActiveServices(...args),
  findActiveServiceById: (...args: unknown[]): unknown => mockFindActiveServiceById(...args),
}));

const mockGet = jest.fn();
const mockSetex = jest.fn();

jest.mock('../../../shared/redis/redis', () => ({
  getRedis: (): unknown => ({
    get: (...args: unknown[]): unknown => mockGet(...args),
    setex: (...args: unknown[]): unknown => mockSetex(...args),
  }),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockServiceRecord = {
  id: 'svc-1',
  name: 'YouTube Views',
  description: 'High quality views',
  platform: 'YOUTUBE',
  type: 'VIEWS',
  pricePer1000: { toNumber: (): number => 5.0 },
  minQuantity: 100,
  maxQuantity: 100000,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const expectedResponse = {
  id: 'svc-1',
  name: 'YouTube Views',
  description: 'High quality views',
  platform: 'YOUTUBE',
  type: 'VIEWS',
  pricePer1000: 5.0,
  minQuantity: 100,
  maxQuantity: 100000,
};

describe('Catalog Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listServices', () => {
    const defaultQuery = { page: 1, limit: 20 };

    it('should return cached data on cache hit', async () => {
      const cachedData = {
        services: [expectedResponse],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockGet.mockResolvedValue(JSON.stringify(cachedData));

      const result = await listServices(defaultQuery);

      expect(result).toEqual(cachedData);
      expect(mockFindActiveServices).not.toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledWith('catalog:list:all:all:1:20');
    });

    it('should query DB and cache on cache miss', async () => {
      mockGet.mockResolvedValue(null);
      mockFindActiveServices.mockResolvedValue({
        services: [mockServiceRecord],
        total: 1,
      });

      const result = await listServices(defaultQuery);

      expect(result.services).toHaveLength(1);
      expect(result.services[0]).toEqual(expectedResponse);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(mockFindActiveServices).toHaveBeenCalledWith({
        platform: undefined,
        type: undefined,
        page: 1,
        limit: 20,
      });
      expect(mockSetex).toHaveBeenCalledWith(
        'catalog:list:all:all:1:20',
        300,
        JSON.stringify(result),
      );
    });

    it('should use correct cache key with platform filter', async () => {
      mockGet.mockResolvedValue(null);
      mockFindActiveServices.mockResolvedValue({ services: [], total: 0 });

      await listServices({ page: 1, limit: 20, platform: 'YOUTUBE' });

      expect(mockGet).toHaveBeenCalledWith('catalog:list:YOUTUBE:all:1:20');
    });

    it('should use correct cache key with type filter', async () => {
      mockGet.mockResolvedValue(null);
      mockFindActiveServices.mockResolvedValue({ services: [], total: 0 });

      await listServices({ page: 1, limit: 20, type: 'VIEWS' });

      expect(mockGet).toHaveBeenCalledWith('catalog:list:all:VIEWS:1:20');
    });

    it('should use correct cache key with both filters', async () => {
      mockGet.mockResolvedValue(null);
      mockFindActiveServices.mockResolvedValue({ services: [], total: 0 });

      await listServices({ page: 2, limit: 10, platform: 'INSTAGRAM', type: 'LIKES' });

      expect(mockGet).toHaveBeenCalledWith('catalog:list:INSTAGRAM:LIKES:2:10');
    });

    it('should cache with 300 second TTL', async () => {
      mockGet.mockResolvedValue(null);
      mockFindActiveServices.mockResolvedValue({ services: [], total: 0 });

      await listServices(defaultQuery);

      expect(mockSetex).toHaveBeenCalledWith(expect.any(String), 300, expect.any(String));
    });

    it('should calculate totalPages correctly', async () => {
      mockGet.mockResolvedValue(null);
      mockFindActiveServices.mockResolvedValue({ services: [], total: 45 });

      const result = await listServices({ page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should return empty services on cache miss with no data', async () => {
      mockGet.mockResolvedValue(null);
      mockFindActiveServices.mockResolvedValue({ services: [], total: 0 });

      const result = await listServices(defaultQuery);

      expect(result.services).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('getService', () => {
    const serviceId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return cached data on cache hit', async () => {
      mockGet.mockResolvedValue(JSON.stringify(expectedResponse));

      const result = await getService(serviceId);

      expect(result).toEqual(expectedResponse);
      expect(mockFindActiveServiceById).not.toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledWith(`catalog:service:${serviceId}`);
    });

    it('should query DB and cache on cache miss when found', async () => {
      mockGet.mockResolvedValue(null);
      mockFindActiveServiceById.mockResolvedValue(mockServiceRecord);

      const result = await getService(serviceId);

      expect(result).toEqual(expectedResponse);
      expect(mockFindActiveServiceById).toHaveBeenCalledWith(serviceId);
      expect(mockSetex).toHaveBeenCalledWith(
        `catalog:service:${serviceId}`,
        300,
        JSON.stringify(expectedResponse),
      );
    });

    it('should throw NotFoundError on cache miss when not found', async () => {
      mockGet.mockResolvedValue(null);
      mockFindActiveServiceById.mockResolvedValue(null);

      await expect(getService(serviceId)).rejects.toThrow('Service not found');
    });

    it('should not cache when service is not found', async () => {
      mockGet.mockResolvedValue(null);
      mockFindActiveServiceById.mockResolvedValue(null);

      await expect(getService(serviceId)).rejects.toThrow();

      expect(mockSetex).not.toHaveBeenCalled();
    });

    it('should cache with 300 second TTL', async () => {
      mockGet.mockResolvedValue(null);
      mockFindActiveServiceById.mockResolvedValue(mockServiceRecord);

      await getService(serviceId);

      expect(mockSetex).toHaveBeenCalledWith(expect.any(String), 300, expect.any(String));
    });
  });
});
