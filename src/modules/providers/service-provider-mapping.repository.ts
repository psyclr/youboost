import type { PrismaClient } from '../../generated/prisma';

/** One panel a service can be fulfilled by, in failover-priority order. */
export interface PanelCandidate {
  providerId: string;
  externalServiceId: string;
  priority: number;
  providerCost: number;
}

export interface ServiceProviderMappingRepository {
  /** Active panels for a service, ordered by priority asc then cost asc. */
  listActiveByServiceId(serviceId: string): Promise<PanelCandidate[]>;
}

export function createServiceProviderMappingRepository(
  prisma: PrismaClient,
): ServiceProviderMappingRepository {
  return {
    async listActiveByServiceId(serviceId): Promise<PanelCandidate[]> {
      const rows = await prisma.serviceProviderMapping.findMany({
        where: { serviceId, isActive: true },
        orderBy: [{ priority: 'asc' }, { providerCost: 'asc' }],
      });
      return rows.map((r) => ({
        providerId: r.providerId,
        externalServiceId: r.externalServiceId,
        priority: r.priority,
        providerCost: Number(r.providerCost),
      }));
    },
  };
}
