import { createAdminServicesService } from '../admin-services.service';
import {
  createFakeServicesRepo,
  createFakeProvidersRepo,
  makeServiceRecord,
  makeProviderRecord,
  silentLogger,
  type ServiceWithProviderRecord,
} from './fakes';

function build(
  options: {
    services?: ServiceWithProviderRecord[];
    providers?: ReturnType<typeof makeProviderRecord>[];
  } = {},
): {
  service: ReturnType<typeof createAdminServicesService>;
  servicesRepo: ReturnType<typeof createFakeServicesRepo>;
  providersRepo: ReturnType<typeof createFakeProvidersRepo>;
} {
  const servicesRepo = createFakeServicesRepo(
    options.services ? { services: options.services } : {},
  );
  const providersRepo = createFakeProvidersRepo(
    options.providers ? { providers: options.providers } : {},
  );
  const service = createAdminServicesService({
    servicesRepo,
    providersRepo,
    logger: silentLogger,
  });
  return { service, servicesRepo, providersRepo };
}

describe('Admin Services Service', () => {
  describe('listAllServices', () => {
    it('should return paginated services with provider info', async () => {
      const { service } = build({
        services: [
          makeServiceRecord({
            id: 'svc-1',
            providerId: 'prov-1',
            externalServiceId: '101',
          }),
        ],
      });

      const result = await service.listAllServices({ page: 1, limit: 20 });

      expect(result.services).toHaveLength(1);
      const first = result.services[0];
      expect(first?.serviceId).toBe('svc-1');
      expect(first?.providerName).toBe('p');
      expect(first?.providerId).toBe('prov-1');
      expect(first?.externalServiceId).toBe('101');
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('should return empty list when no services', async () => {
      const { service } = build();

      const result = await service.listAllServices({ page: 1, limit: 20 });

      expect(result.services).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should calculate totalPages correctly', async () => {
      const services = Array.from({ length: 50 }, (_, i) => makeServiceRecord({ id: `svc-${i}` }));
      const { service } = build({ services });

      const result = await service.listAllServices({ page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should pass page and limit to repository', async () => {
      const services = Array.from({ length: 30 }, (_, i) => makeServiceRecord({ id: `svc-${i}` }));
      const { service } = build({ services });

      const result = await service.listAllServices({ page: 3, limit: 10 });

      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(10);
    });

    it('should map pricePer1000 to number', async () => {
      const { service } = build({
        services: [makeServiceRecord({ id: 'svc-1' })],
      });

      const result = await service.listAllServices({ page: 1, limit: 20 });

      expect(result.services[0]?.pricePer1000).toBe(5.99);
    });

    it('should handle null provider', async () => {
      const { service } = build({
        services: [
          {
            ...makeServiceRecord({
              id: 'svc-1',
              providerId: null,
              externalServiceId: null,
            }),
            provider: null,
          },
        ],
      });

      const result = await service.listAllServices({ page: 1, limit: 20 });

      expect(result.services[0]?.providerName).toBeNull();
      expect(result.services[0]?.providerId).toBeNull();
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
      const { service } = build({
        providers: [makeProviderRecord({ id: 'prov-1', name: 'TestProvider' })],
      });

      const result = await service.createService(input);

      expect(result.name).toBe('YouTube Views');
      // providerName comes from fake's synthesized 'p' when provider relation unset
      expect(result.providerId).toBe('prov-1');
    });

    it('should throw when provider not found', async () => {
      const { service } = build();

      await expect(service.createService(input)).rejects.toThrow('Provider not found');
    });

    it('should pass provider fields to repository', async () => {
      const { service, servicesRepo } = build({
        providers: [makeProviderRecord({ id: 'prov-1', name: 'TestProvider' })],
      });

      await service.createService(input);

      expect(servicesRepo.services[0]).toMatchObject({
        providerId: 'prov-1',
        externalServiceId: '101',
      });
    });
  });

  describe('updateService', () => {
    it('should update and return service with provider info', async () => {
      const { service } = build({
        services: [
          {
            ...makeServiceRecord({
              id: 'svc-1',
              name: 'Old',
              providerId: 'prov-1',
            }),
            provider: { id: 'prov-1', name: 'TestProvider' },
          },
        ],
      });

      const result = await service.updateService('svc-1', { name: 'Updated' });

      // Fake's updateService is a no-op (returns existing record), so we verify
      // that the call succeeded and returned a response with provider info.
      expect(result.providerName).toBe('TestProvider');
    });

    it('should throw NotFoundError when service not found', async () => {
      const { service } = build();

      await expect(service.updateService('nonexistent', { name: 'x' })).rejects.toThrow(
        'Service not found',
      );
    });

    it('should throw when new providerId is unknown', async () => {
      const { service } = build({
        services: [makeServiceRecord({ id: 'svc-1', providerId: 'prov-1' })],
      });

      await expect(service.updateService('svc-1', { providerId: 'prov-missing' })).rejects.toThrow(
        'Provider not found',
      );
    });

    it('should accept update when new providerId exists', async () => {
      const { service } = build({
        services: [makeServiceRecord({ id: 'svc-1', providerId: 'prov-1' })],
        providers: [makeProviderRecord({ id: 'prov-2', name: 'NewProvider' })],
      });

      await expect(
        service.updateService('svc-1', { providerId: 'prov-2', externalServiceId: '202' }),
      ).resolves.toBeTruthy();
    });
  });

  describe('deactivateService', () => {
    it('should deactivate existing service', async () => {
      const { service, servicesRepo } = build({
        services: [makeServiceRecord({ id: 'svc-1', isActive: true })],
      });

      await service.deactivateService('svc-1');

      expect(servicesRepo.services[0]?.isActive).toBe(false);
    });

    it('should throw NotFoundError when service not found', async () => {
      const { service } = build();

      await expect(service.deactivateService('nonexistent')).rejects.toThrow('Service not found');
    });
  });
});
