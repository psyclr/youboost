import { findServiceById, findActiveServices } from '../service.repository';

const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    service: {
      findUnique: (...args: unknown[]): unknown => mockFindUnique(...args),
      findMany: (...args: unknown[]): unknown => mockFindMany(...args),
    },
  }),
}));

const mockService = {
  id: 'svc-1',
  name: 'YouTube Views',
  description: 'High quality views',
  platform: 'YOUTUBE',
  type: 'VIEWS',
  pricePer1000: 2.5,
  minQuantity: 100,
  maxQuantity: 100000,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Service Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findServiceById', () => {
    it('should return service when found', async () => {
      mockFindUnique.mockResolvedValue(mockService);

      const result = await findServiceById('svc-1');

      expect(result).toEqual(mockService);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'svc-1' } });
    });

    it('should return null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await findServiceById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findActiveServices', () => {
    it('should return active services', async () => {
      mockFindMany.mockResolvedValue([mockService]);

      const result = await findActiveServices();

      expect(result).toHaveLength(1);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by platform', async () => {
      mockFindMany.mockResolvedValue([]);

      await findActiveServices({ platform: 'YOUTUBE' });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true, platform: 'YOUTUBE' },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by type', async () => {
      mockFindMany.mockResolvedValue([]);

      await findActiveServices({ type: 'VIEWS' });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true, type: 'VIEWS' },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by both platform and type', async () => {
      mockFindMany.mockResolvedValue([]);

      await findActiveServices({ platform: 'TIKTOK', type: 'LIKES' });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true, platform: 'TIKTOK', type: 'LIKES' },
        orderBy: { name: 'asc' },
      });
    });

    it('should return empty array when no services match', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await findActiveServices();

      expect(result).toHaveLength(0);
    });
  });
});
