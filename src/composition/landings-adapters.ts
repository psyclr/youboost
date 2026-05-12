import type { CatalogService } from '../modules/catalog/catalog.service';
import type {
  ServiceLookupPort,
  ServiceLookupRecord,
} from '../modules/landings/ports/service-lookup.port';

export function createLandingServiceLookup(catalog: CatalogService): ServiceLookupPort {
  return {
    async getService(serviceId): Promise<ServiceLookupRecord> {
      const svc = await catalog.getService(serviceId);
      return {
        id: svc.id,
        name: svc.name,
        pricePer1000: svc.pricePer1000,
        minQuantity: svc.minQuantity,
        maxQuantity: svc.maxQuantity,
      };
    },
  };
}
