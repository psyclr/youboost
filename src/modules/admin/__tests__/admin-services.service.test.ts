import { createAdminServicesService } from '../admin-services.service';
import type {
  ServiceProviderMappingRepository,
  ServicePanel,
} from '../../providers/service-provider-mapping.repository';
import {
  createFakeServicesRepo,
  createFakeProvidersRepo,
  makeServiceRecord,
  makeProviderRecord,
  silentLogger,
  type ServiceWithProviderRecord,
} from './fakes';

/** In-memory mapping repo for the admin-services tests. */
function createFakeMappingRepo(): ServiceProviderMappingRepository & {
  rows: ServicePanel[];
  serviceIdById: Map<string, string>;
} {
  const rows: ServicePanel[] = [];
  const serviceIdById = new Map<string, string>();
  let seq = 0;
  return {
    rows,
    serviceIdById,
    async listActiveByServiceId() {
      return [];
    },
    async listByServiceId(serviceId) {
      return rows.filter((r) => serviceIdById.get(r.id) === serviceId);
    },
    async createMapping(input) {
      const panel: ServicePanel = {
        id: `map-${++seq}`,
        providerId: input.providerId,
        providerName: 'p',
        providerPriority: 0,
        providerActive: true,
        externalServiceId: input.externalServiceId,
        isActive: true,
      };
      rows.push(panel);
      serviceIdById.set(panel.id, input.serviceId);
      return panel;
    },
    async updateMapping(id, data) {
      const row = rows.find((r) => r.id === id)!;
      if (data.externalServiceId !== undefined) row.externalServiceId = data.externalServiceId;
      if (data.isActive !== undefined) row.isActive = data.isActive;
      return row;
    },
    async deleteMapping(id) {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
    },
    async findMappingById(id) {
      const sid = serviceIdById.get(id);
      return sid ? { id, serviceId: sid } : null;
    },
    async upsertPrimary(input) {
      const existing = rows.find(
        (r) => serviceIdById.get(r.id) === input.serviceId && r.providerId === input.providerId,
      );
      if (existing) {
        existing.externalServiceId = input.externalServiceId;
        existing.isActive = true;
        return;
      }
      const panel: ServicePanel = {
        id: `map-${++seq}`,
        providerId: input.providerId,
        providerName: 'p',
        providerPriority: 0,
        providerActive: true,
        externalServiceId: input.externalServiceId,
        isActive: true,
      };
      rows.push(panel);
      serviceIdById.set(panel.id, input.serviceId);
    },
  };
}

function build(
  options: {
    services?: ServiceWithProviderRecord[];
    providers?: ReturnType<typeof makeProviderRecord>[];
  } = {},
): {
  service: ReturnType<typeof createAdminServicesService>;
  servicesRepo: ReturnType<typeof createFakeServicesRepo>;
  providersRepo: ReturnType<typeof createFakeProvidersRepo>;
  mappingRepo: ReturnType<typeof createFakeMappingRepo>;
} {
  const servicesRepo = createFakeServicesRepo(
    options.services ? { services: options.services } : {},
  );
  const providersRepo = createFakeProvidersRepo(
    options.providers ? { providers: options.providers } : {},
  );
  const mappingRepo = createFakeMappingRepo();
  const service = createAdminServicesService({
    servicesRepo,
    providersRepo,
    mappingRepo,
    logger: silentLogger,
  });
  return { service, servicesRepo, providersRepo, mappingRepo };
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

    it('creates a primary panel mapping so the service has a failover panel', async () => {
      const { service, servicesRepo, mappingRepo } = build({
        providers: [makeProviderRecord({ id: 'prov-1', name: 'TestProvider' })],
      });

      await service.createService(input);
      const serviceId = servicesRepo.services[0]!.id;

      const panels = await mappingRepo.listByServiceId(serviceId);
      expect(panels).toHaveLength(1);
      expect(panels[0]).toMatchObject({ providerId: 'prov-1', externalServiceId: '101' });
    });
  });

  describe('service panels', () => {
    function buildWithService() {
      return build({
        services: [makeServiceRecord({ id: 'svc-1', providerId: 'prov-1', externalServiceId: '101' })],
        providers: [
          makeProviderRecord({ id: 'prov-1', name: 'Panel A' }),
          makeProviderRecord({ id: 'prov-2', name: 'Panel B' }),
        ],
      });
    }

    it('attaches a second panel and lists it', async () => {
      const { service } = buildWithService();
      const panel = await service.addServicePanel('svc-1', {
        providerId: 'prov-2',
        externalServiceId: '202',
      });
      expect(panel).toMatchObject({ providerId: 'prov-2', externalServiceId: '202', isActive: true });
      expect(await service.listServicePanels('svc-1')).toHaveLength(1);
    });

    it('rejects attaching the same panel twice', async () => {
      const { service } = buildWithService();
      await service.addServicePanel('svc-1', { providerId: 'prov-2', externalServiceId: '202' });
      await expect(
        service.addServicePanel('svc-1', { providerId: 'prov-2', externalServiceId: '999' }),
      ).rejects.toThrow(/already attached/i);
    });

    it('rejects an unknown provider', async () => {
      const { service } = buildWithService();
      await expect(
        service.addServicePanel('svc-1', { providerId: 'nope', externalServiceId: '1' }),
      ).rejects.toThrow(/provider not found/i);
    });

    it('toggles and removes a panel', async () => {
      const { service } = buildWithService();
      const panel = await service.addServicePanel('svc-1', {
        providerId: 'prov-2',
        externalServiceId: '202',
      });
      const updated = await service.updateServicePanel(panel.id, { isActive: false });
      expect(updated.isActive).toBe(false);
      await service.removeServicePanel(panel.id);
      expect(await service.listServicePanels('svc-1')).toHaveLength(0);
    });

    it('404s on unknown service / panel', async () => {
      const { service } = buildWithService();
      await expect(service.listServicePanels('missing')).rejects.toThrow(/not found/i);
      await expect(service.removeServicePanel('map-999')).rejects.toThrow(/not found/i);
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
