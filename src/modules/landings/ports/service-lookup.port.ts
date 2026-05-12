/**
 * Narrow consumer-side port for looking up service pricing/bounds.
 * Adapted from CatalogService in composition root so landings doesn't
 * import catalog's full surface.
 */
export interface ServiceLookupPort {
  getService(serviceId: string): Promise<ServiceLookupRecord>;
}

export interface ServiceLookupRecord {
  id: string;
  name: string;
  pricePer1000: number;
  minQuantity: number;
  maxQuantity: number;
}
