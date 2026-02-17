import {
  listAllServices,
  createService,
  updateService,
  deactivateService,
} from '../admin-services.service';

const mockFindAllServices = jest.fn();
const mockCreateService = jest.fn();
const mockUpdateService = jest.fn();
const mockDeactivateService = jest.fn();
const mockFindServiceById = jest.fn();

jest.mock('../../orders/service.repository', () => ({
  findAllServices: (...args: unknown[]): unknown => mockFindAllServices(...args),
  createService: (...args: unknown[]): unknown => mockCreateService(...args),
  updateService: (...args: unknown[]): unknown => mockUpdateService(...args),
  deactivateService: (...args: unknown[]): unknown => mockDeactivateService(...args),
  findServiceById: (...args: unknown[]): unknown => mockFindServiceById(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../../billing/utils/decimal', () => ({
  toNumber: (v: unknown): number => Number(v),
}));

const mockServiceRecord = {
  id: 'svc-1',
  name: 'YouTube Views',
  description: 'Fast delivery',
  platform: 'YOUTUBE',
  type: 'VIEWS',
  pricePer1000: 5.99,
  minQuantity: 100,
  maxQuantity: 100000,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('Admin Services Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listAllServices', () => {
    it('should return all services', async () => {
      mockFindAllServices.mockResolvedValue([mockServiceRecord]);

      const result = await listAllServices();

      expect(result.services).toHaveLength(1);
      const first = result.services[0];
      expect(first?.serviceId).toBe('svc-1');
    });

    it('should return empty list when no services', async () => {
      mockFindAllServices.mockResolvedValue([]);

      const result = await listAllServices();

      expect(result.services).toHaveLength(0);
    });

    it('should map pricePer1000 to number', async () => {
      mockFindAllServices.mockResolvedValue([mockServiceRecord]);

      const result = await listAllServices();

      const first = result.services[0];
      expect(first?.pricePer1000).toBe(5.99);
    });
  });

  describe('createService', () => {
    const input = {
      name: 'YouTube Views',
      platform: 'YOUTUBE' as const,
      type: 'VIEWS' as const,
      pricePer1000: 5.99,
      minQuantity: 100,
      maxQuantity: 100000,
    };

    it('should create service and return response', async () => {
      mockCreateService.mockResolvedValue(mockServiceRecord);

      const result = await createService(input);

      expect(result.serviceId).toBe('svc-1');
      expect(result.name).toBe('YouTube Views');
    });

    it('should pass description to repository', async () => {
      mockCreateService.mockResolvedValue(mockServiceRecord);

      await createService({ ...input, description: 'Fast delivery' });

      expect(mockCreateService).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Fast delivery' }),
      );
    });

    it('should pass all fields to repository', async () => {
      mockCreateService.mockResolvedValue(mockServiceRecord);

      await createService(input);

      expect(mockCreateService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'YouTube Views',
          platform: 'YOUTUBE',
          type: 'VIEWS',
          pricePer1000: 5.99,
          minQuantity: 100,
          maxQuantity: 100000,
        }),
      );
    });
  });

  describe('updateService', () => {
    it('should update and return service', async () => {
      mockFindServiceById.mockResolvedValue(mockServiceRecord);
      mockUpdateService.mockResolvedValue({ ...mockServiceRecord, name: 'Updated' });

      const result = await updateService('svc-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundError when service not found', async () => {
      mockFindServiceById.mockResolvedValue(null);

      await expect(updateService('nonexistent', { name: 'x' })).rejects.toThrow(
        'Service not found',
      );
    });

    it('should pass update data to repository', async () => {
      mockFindServiceById.mockResolvedValue(mockServiceRecord);
      mockUpdateService.mockResolvedValue(mockServiceRecord);

      await updateService('svc-1', { pricePer1000: 9.99, isActive: false });

      expect(mockUpdateService).toHaveBeenCalledWith('svc-1', {
        pricePer1000: 9.99,
        isActive: false,
      });
    });
  });

  describe('deactivateService', () => {
    it('should deactivate existing service', async () => {
      mockFindServiceById.mockResolvedValue(mockServiceRecord);
      mockDeactivateService.mockResolvedValue({ ...mockServiceRecord, isActive: false });

      await deactivateService('svc-1');

      expect(mockDeactivateService).toHaveBeenCalledWith('svc-1');
    });

    it('should throw NotFoundError when service not found', async () => {
      mockFindServiceById.mockResolvedValue(null);

      await expect(deactivateService('nonexistent')).rejects.toThrow('Service not found');
    });
  });
});
