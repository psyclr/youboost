import { findActiveServices, findActiveServiceById } from '../catalog.repository';

const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindFirst = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    service: {
      findMany: (...args: unknown[]): unknown => mockFindMany(...args),
      count: (...args: unknown[]): unknown => mockCount(...args),
      findFirst: (...args: unknown[]): unknown => mockFindFirst(...args),
    },
  }),
}));

const mockService = {
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

describe('Catalog Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findActiveServices', () => {
    it('should return services with pagination', async () => {
      mockFindMany.mockResolvedValue([mockService]);
      mockCount.mockResolvedValue(1);

      const result = await findActiveServices({ page: 1, limit: 20 });

      expect(result.services).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          skip: 0,
          take: 20,
        }),
      );
      expect(mockCount).toHaveBeenCalledWith({ where: { isActive: true } });
    });

    it('should filter by platform', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findActiveServices({ platform: 'YOUTUBE', page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, platform: 'YOUTUBE' },
        }),
      );
      expect(mockCount).toHaveBeenCalledWith({
        where: { isActive: true, platform: 'YOUTUBE' },
      });
    });

    it('should filter by type', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findActiveServices({ type: 'VIEWS', page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, type: 'VIEWS' },
        }),
      );
    });

    it('should filter by both platform and type', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findActiveServices({ platform: 'INSTAGRAM', type: 'LIKES', page: 1, limit: 10 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, platform: 'INSTAGRAM', type: 'LIKES' },
        }),
      );
    });

    it('should calculate skip based on page', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findActiveServices({ page: 3, limit: 10 });

      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });

    it('should return empty array when no services found', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const result = await findActiveServices({ page: 1, limit: 20 });

      expect(result.services).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findActiveServiceById', () => {
    it('should return active service by id', async () => {
      mockFindFirst.mockResolvedValue(mockService);

      const result = await findActiveServiceById('svc-1');

      expect(result).toEqual(mockService);
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: 'svc-1', isActive: true },
      });
    });

    it('should return null if service not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await findActiveServiceById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null if service is inactive', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await findActiveServiceById('svc-inactive');

      expect(result).toBeNull();
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: 'svc-inactive', isActive: true },
      });
    });
  });
});
