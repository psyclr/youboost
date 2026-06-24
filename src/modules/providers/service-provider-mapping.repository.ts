import type { PrismaClient } from '../../generated/prisma';

/** One panel a service can be fulfilled by, in failover-priority order. */
export interface PanelCandidate {
  providerId: string;
  externalServiceId: string;
  priority: number;
  providerCost: number;
}

export interface ServiceProviderMappingRepository {
  /**
   * Active panels for a service, ordered by the admin-managed panel priority
   * (`provider.priority`, DESC — higher = preferred), cost as tiebreaker. Only
   * active providers are included. Priority is never hardcoded: it comes from the
   * provider record the admin edits.
   */
  listActiveByServiceId(serviceId: string): Promise<PanelCandidate[]>;
}

export function createServiceProviderMappingRepository(
  prisma: PrismaClient,
): ServiceProviderMappingRepository {
  return {
    async listActiveByServiceId(serviceId): Promise<PanelCandidate[]> {
      const rows = await prisma.serviceProviderMapping.findMany({
        where: { serviceId, isActive: true, provider: { isActive: true } },
        orderBy: [{ provider: { priority: 'desc' } }, { providerCost: 'asc' }],
        include: { provider: { select: { priority: true } } },
      });
      return rows.map((r) => ({
        providerId: r.providerId,
        externalServiceId: r.externalServiceId,
        priority: r.provider.priority,
        providerCost: Number(r.providerCost),
      }));
    },
  };
}
