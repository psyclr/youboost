import { createServicesRepository } from '../service.repository';
import type { PrismaClient } from '../../../generated/prisma';

const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

const fakePrisma = {
  service: {
    findUnique: (...args: unknown[]): unknown => mockFindUnique(...args),
    findMany: (...args: unknown[]): unknown => mockFindMany(...args),
    create: (...args: unknown[]): unknown => mockCreate(...args),
    update: (...args: unknown[]): unknown => mockUpdate(...args),
  },
} as unknown as PrismaClient;

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

describe('Services Repository (factory)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findServiceById', () => {
    it('should return service when found', async () => {
      mockFindUnique.mockResolvedValue(mockService);

      const repo = createServicesRepository(fakePrisma);
      const result = await repo.findServiceById('svc-1');

      expect(result).toEqual(mockService);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'svc-1' } });
    });

    it('should return null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const repo = createServicesRepository(fakePrisma);
      const result = await repo.findServiceById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findActiveServices', () => {
    it('should return active services', async () => {
      mockFindMany.mockResolvedValue([mockService]);

      const repo = createServicesRepository(fakePrisma);
      const result = await repo.findActiveServices();

      expect(result).toHaveLength(1);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by platform', async () => {
      mockFindMany.mockResolvedValue([]);

      const repo = createServicesRepository(fakePrisma);
      await repo.findActiveServices({ platform: 'YOUTUBE' });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true, platform: 'YOUTUBE' },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by type', async () => {
      mockFindMany.mockResolvedValue([]);

      const repo = createServicesRepository(fakePrisma);
      await repo.findActiveServices({ type: 'VIEWS' });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true, type: 'VIEWS' },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by both platform and type', async () => {
      mockFindMany.mockResolvedValue([]);

      const repo = createServicesRepository(fakePrisma);
      await repo.findActiveServices({ platform: 'TIKTOK', type: 'LIKES' });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true, platform: 'TIKTOK', type: 'LIKES' },
        orderBy: { name: 'asc' },
      });
    });

    it('should return empty array when no services match', async () => {
      mockFindMany.mockResolvedValue([]);
      const repo = createServicesRepository(fakePrisma);
      const result = await repo.findActiveServices();
      expect(result).toHaveLength(0);
    });
  });

  describe('findAllServices', () => {
    it('should return all services without filter', async () => {
      mockFindMany.mockResolvedValue([mockService]);
      const repo = createServicesRepository(fakePrisma);
      const result = await repo.findAllServices();
      expect(result).toHaveLength(1);
      expect(mockFindMany).toHaveBeenCalledWith({ where: {}, orderBy: { name: 'asc' } });
    });

    it('should filter by isActive', async () => {
      mockFindMany.mockResolvedValue([]);
      const repo = createServicesRepository(fakePrisma);
      await repo.findAllServices({ isActive: false });
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: false },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('createService', () => {
    it('should create a service', async () => {
      mockCreate.mockResolvedValue(mockService);
      const repo = createServicesRepository(fakePrisma);
      const result = await repo.createService({
        name: 'YouTube Views',
        platform: 'YOUTUBE',
        type: 'VIEWS',
        pricePer1000: 2.5,
        minQuantity: 100,
        maxQuantity: 100000,
      });
      expect(result).toEqual(mockService);
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'YouTube Views', platform: 'YOUTUBE' }),
      });
    });

    it('should pass null description when not provided', async () => {
      mockCreate.mockResolvedValue(mockService);
      const repo = createServicesRepository(fakePrisma);
      await repo.createService({
        name: 'Test',
        platform: 'YOUTUBE',
        type: 'VIEWS',
        pricePer1000: 1,
        minQuantity: 1,
        maxQuantity: 1000,
      });
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ description: null }),
      });
    });
  });

  describe('updateService', () => {
    it('should update specified fields', async () => {
      mockUpdate.mockResolvedValue({ ...mockService, name: 'Updated' });
      const repo = createServicesRepository(fakePrisma);
      const result = await repo.updateService('svc-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        data: { name: 'Updated' },
      });
    });

    it('should not include undefined fields in update', async () => {
      mockUpdate.mockResolvedValue(mockService);
      const repo = createServicesRepository(fakePrisma);
      await repo.updateService('svc-1', { pricePer1000: 9.99 });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        data: { pricePer1000: 9.99 },
      });
    });
  });

  describe('deactivateService', () => {
    it('should set isActive to false', async () => {
      mockUpdate.mockResolvedValue({ ...mockService, isActive: false });
      const repo = createServicesRepository(fakePrisma);
      const result = await repo.deactivateService('svc-1');
      expect(result.isActive).toBe(false);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        data: { isActive: false },
      });
    });
  });
});
