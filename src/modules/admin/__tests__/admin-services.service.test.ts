import {
  listAllServices,
  createService,
  updateService,
  deactivateService,
} from '../admin-services.service';

const mockFindAllServicesPaginatedWithProvider = jest.fn();
const mockCreateService = jest.fn();
const mockUpdateService = jest.fn();
const mockDeactivateService = jest.fn();
const mockFindServiceById = jest.fn();
const mockFindServiceWithProvider = jest.fn();

jest.mock('../../orders/service.repository', () => ({
  findAllServicesPaginatedWithProvider: (...args: unknown[]): unknown =>
    mockFindAllServicesPaginatedWithProvider(...args),
  createService: (...args: unknown[]): unknown => mockCreateService(...args),
  updateService: (...args: unknown[]): unknown => mockUpdateService(...args),
  deactivateService: (...args: unknown[]): unknown => mockDeactivateService(...args),
  findServiceById: (...args: unknown[]): unknown => mockFindServiceById(...args),
  findServiceWithProvider: (...args: unknown[]): unknown => mockFindServiceWithProvider(...args),
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

const mockFindProviderById = jest.fn();
jest.mock('../../providers/providers.repository', () => ({
  findProviderById: (...args: unknown[]): unknown => mockFindProviderById(...args),
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
  providerId: 'prov-1',
  externalServiceId: '101',
  provider: { id: 'prov-1', name: 'TestProvider' },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('Admin Services Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listAllServices', () => {
    it('should return paginated services with provider info', async () => {
      mockFindAllServicesPaginatedWithProvider.mockResolvedValue({
        services: [mockServiceRecord],
        total: 1,
      });

      const result = await listAllServices({ page: 1, limit: 20 });

      expect(result.services).toHaveLength(1);
      const first = result.services[0];
      expect(first?.serviceId).toBe('svc-1');
      expect(first?.providerName).toBe('TestProvider');
      expect(first?.providerId).toBe('prov-1');
      expect(first?.externalServiceId).toBe('101');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should return empty list when no services', async () => {
      mockFindAllServicesPaginatedWithProvider.mockResolvedValue({
        services: [],
        total: 0,
      });

      const result = await listAllServices({ page: 1, limit: 20 });

      expect(result.services).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should calculate totalPages correctly', async () => {
      mockFindAllServicesPaginatedWithProvider.mockResolvedValue({
        services: [],
        total: 50,
      });

      const result = await listAllServices({ page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should pass page and limit to repository', async () => {
      mockFindAllServicesPaginatedWithProvider.mockResolvedValue({
        services: [],
        total: 0,
      });

      await listAllServices({ page: 3, limit: 10 });

      expect(mockFindAllServicesPaginatedWithProvider).toHaveBeenCalledWith(3, 10);
    });

    it('should map pricePer1000 to number', async () => {
      mockFindAllServicesPaginatedWithProvider.mockResolvedValue({
        services: [mockServiceRecord],
        total: 1,
      });

      const result = await listAllServices({ page: 1, limit: 20 });

      const first = result.services[0];
      expect(first?.pricePer1000).toBe(5.99);
    });

    it('should handle null provider', async () => {
      const serviceNoProvider = {
        ...mockServiceRecord,
        providerId: null,
        externalServiceId: null,
        provider: null,
      };
      mockFindAllServicesPaginatedWithProvider.mockResolvedValue({
        services: [serviceNoProvider],
        total: 1,
      });

      const result = await listAllServices({ page: 1, limit: 20 });

      const first = result.services[0];
      expect(first?.providerName).toBeNull();
      expect(first?.providerId).toBeNull();
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
      providerId: 'prov-1',
      externalServiceId: '101',
    };

    it('should create service and return response with provider', async () => {
      mockFindProviderById.mockResolvedValue({ id: 'prov-1', name: 'TestProvider' });
      mockCreateService.mockResolvedValue(mockServiceRecord);
      mockFindServiceWithProvider.mockResolvedValue(mockServiceRecord);

      const result = await createService(input);

      expect(result.serviceId).toBe('svc-1');
      expect(result.name).toBe('YouTube Views');
      expect(result.providerName).toBe('TestProvider');
    });

    it('should pass provider fields to repository', async () => {
      mockFindProviderById.mockResolvedValue({ id: 'prov-1', name: 'TestProvider' });
      mockCreateService.mockResolvedValue(mockServiceRecord);
      mockFindServiceWithProvider.mockResolvedValue(mockServiceRecord);

      await createService(input);

      expect(mockCreateService).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'prov-1',
          externalServiceId: '101',
        }),
      );
    });

    it('should re-fetch with provider join after creation', async () => {
      mockFindProviderById.mockResolvedValue({ id: 'prov-1', name: 'TestProvider' });
      mockCreateService.mockResolvedValue(mockServiceRecord);
      mockFindServiceWithProvider.mockResolvedValue(mockServiceRecord);

      await createService(input);

      expect(mockFindServiceWithProvider).toHaveBeenCalledWith('svc-1');
    });
  });

  describe('updateService', () => {
    it('should update and return service with provider info', async () => {
      mockFindServiceById.mockResolvedValue(mockServiceRecord);
      mockUpdateService.mockResolvedValue({ ...mockServiceRecord, name: 'Updated' });
      mockFindServiceWithProvider.mockResolvedValue({ ...mockServiceRecord, name: 'Updated' });

      const result = await updateService('svc-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(result.providerName).toBe('TestProvider');
    });

    it('should throw NotFoundError when service not found', async () => {
      mockFindServiceById.mockResolvedValue(null);

      await expect(updateService('nonexistent', { name: 'x' })).rejects.toThrow(
        'Service not found',
      );
    });

    it('should re-fetch with provider join after update', async () => {
      mockFindServiceById.mockResolvedValue(mockServiceRecord);
      mockUpdateService.mockResolvedValue(mockServiceRecord);
      mockFindServiceWithProvider.mockResolvedValue(mockServiceRecord);

      await updateService('svc-1', { pricePer1000: 9.99 });

      expect(mockFindServiceWithProvider).toHaveBeenCalledWith('svc-1');
    });

    it('should update provider fields', async () => {
      mockFindServiceById.mockResolvedValue(mockServiceRecord);
      mockFindProviderById.mockResolvedValue({ id: 'prov-2', name: 'NewProvider' });
      mockUpdateService.mockResolvedValue({
        ...mockServiceRecord,
        providerId: 'prov-2',
        externalServiceId: '202',
      });
      mockFindServiceWithProvider.mockResolvedValue({
        ...mockServiceRecord,
        providerId: 'prov-2',
        externalServiceId: '202',
        provider: { id: 'prov-2', name: 'NewProvider' },
      });

      const result = await updateService('svc-1', {
        providerId: 'prov-2',
        externalServiceId: '202',
      });

      expect(mockUpdateService).toHaveBeenCalledWith(
        'svc-1',
        expect.objectContaining({
          providerId: 'prov-2',
          externalServiceId: '202',
        }),
      );
      expect(result.providerName).toBe('NewProvider');
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
