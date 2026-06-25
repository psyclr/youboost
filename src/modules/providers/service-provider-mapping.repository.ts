import type { PrismaClient } from '../../generated/prisma';

/** One panel a service can be fulfilled by, in failover-priority order. */
export interface PanelCandidate {
  providerId: string;
  externalServiceId: string;
  priority: number;
  providerCost: number;
}

/** A service↔panel mapping as shown in the admin "Panels" manager. */
export interface ServicePanel {
  id: string;
  providerId: string;
  providerName: string;
  providerPriority: number;
  providerActive: boolean;
  externalServiceId: string;
  isActive: boolean;
}

export interface ServiceProviderMappingRepository {
  /**
   * Active panels for a service, ordered by the admin-managed panel priority
   * (`provider.priority`, DESC — higher = preferred), cost as tiebreaker. Only
   * active providers are included. Priority is never hardcoded: it comes from the
   * provider record the admin edits.
   */
  listActiveByServiceId(serviceId: string): Promise<PanelCandidate[]>;
  /** All mappings for a service (active + inactive), for the admin UI. */
  listByServiceId(serviceId: string): Promise<ServicePanel[]>;
  createMapping(input: {
    serviceId: string;
    providerId: string;
    externalServiceId: string;
  }): Promise<ServicePanel>;
  updateMapping(
    id: string,
    data: { externalServiceId?: string; isActive?: boolean },
  ): Promise<ServicePanel>;
  deleteMapping(id: string): Promise<void>;
  findMappingById(id: string): Promise<{ id: string; serviceId: string } | null>;
  /** Upsert the "primary" panel for a service (keeps the service form's provider in sync). */
  upsertPrimary(input: {
    serviceId: string;
    providerId: string;
    externalServiceId: string;
  }): Promise<void>;
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

    async listByServiceId(serviceId): Promise<ServicePanel[]> {
      const rows = await prisma.serviceProviderMapping.findMany({
        where: { serviceId },
        orderBy: [{ provider: { priority: 'desc' } }, { createdAt: 'asc' }],
        include: { provider: { select: { name: true, priority: true, isActive: true } } },
      });
      return rows.map(toServicePanel);
    },

    async createMapping(input): Promise<ServicePanel> {
      const row = await prisma.serviceProviderMapping.create({
        data: {
          serviceId: input.serviceId,
          providerId: input.providerId,
          externalServiceId: input.externalServiceId,
        },
        include: { provider: { select: { name: true, priority: true, isActive: true } } },
      });
      return toServicePanel(row);
    },

    async updateMapping(id, data): Promise<ServicePanel> {
      const row = await prisma.serviceProviderMapping.update({
        where: { id },
        data: {
          ...(data.externalServiceId !== undefined
            ? { externalServiceId: data.externalServiceId }
            : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
        include: { provider: { select: { name: true, priority: true, isActive: true } } },
      });
      return toServicePanel(row);
    },

    async deleteMapping(id): Promise<void> {
      await prisma.serviceProviderMapping.delete({ where: { id } });
    },

    async findMappingById(id): Promise<{ id: string; serviceId: string } | null> {
      return prisma.serviceProviderMapping.findUnique({
        where: { id },
        select: { id: true, serviceId: true },
      });
    },

    async upsertPrimary(input): Promise<void> {
      await prisma.serviceProviderMapping.upsert({
        where: {
          serviceId_providerId: { serviceId: input.serviceId, providerId: input.providerId },
        },
        update: { externalServiceId: input.externalServiceId, isActive: true },
        create: {
          serviceId: input.serviceId,
          providerId: input.providerId,
          externalServiceId: input.externalServiceId,
        },
      });
    },
  };
}

function toServicePanel(row: {
  id: string;
  providerId: string;
  externalServiceId: string;
  isActive: boolean;
  provider: { name: string; priority: number; isActive: boolean };
}): ServicePanel {
  return {
    id: row.id,
    providerId: row.providerId,
    providerName: row.provider.name,
    providerPriority: row.provider.priority,
    providerActive: row.provider.isActive,
    externalServiceId: row.externalServiceId,
    isActive: row.isActive,
  };
}
