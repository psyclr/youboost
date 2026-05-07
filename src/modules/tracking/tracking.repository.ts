import { getPrisma } from '../../shared/database';
import type { PrismaClient, TrackingLink } from '../../generated/prisma';

export interface TrackingRepository {
  create(data: { code: string; name: string }): Promise<TrackingLink>;
  findAll(): Promise<
    {
      id: string;
      code: string;
      name: string;
      createdAt: Date;
      registrations: number;
      lastRegistration: Date | null;
    }[]
  >;
  findById(id: string): Promise<TrackingLink | null>;
  findByCode(code: string): Promise<TrackingLink | null>;
  deleteById(id: string): Promise<void>;
}

export function createTrackingRepository(prisma: PrismaClient): TrackingRepository {
  async function create(data: { code: string; name: string }): Promise<TrackingLink> {
    return prisma.trackingLink.create({
      data: {
        code: data.code,
        name: data.name,
      },
    });
  }

  async function findAll(): Promise<
    {
      id: string;
      code: string;
      name: string;
      createdAt: Date;
      registrations: number;
      lastRegistration: Date | null;
    }[]
  > {
    const links = await prisma.trackingLink.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (links.length === 0) return [];

    const codes = links.map((l) => l.code);

    const stats = await prisma.user.groupBy({
      by: ['referralCode'],
      where: { referralCode: { in: codes } },
      _count: { id: true },
      _max: { createdAt: true },
    });

    const statsMap = new Map(
      stats.map((s) => [
        s.referralCode,
        { count: s._count.id, lastRegistration: s._max.createdAt },
      ]),
    );

    return links.map((link) => {
      const stat = statsMap.get(link.code);
      return {
        id: link.id,
        code: link.code,
        name: link.name,
        createdAt: link.createdAt,
        registrations: stat?.count ?? 0,
        lastRegistration: stat?.lastRegistration ?? null,
      };
    });
  }

  async function findById(id: string): Promise<TrackingLink | null> {
    return prisma.trackingLink.findUnique({ where: { id } });
  }

  async function findByCode(code: string): Promise<TrackingLink | null> {
    return prisma.trackingLink.findUnique({ where: { code } });
  }

  async function deleteById(id: string): Promise<void> {
    await prisma.trackingLink.delete({ where: { id } });
  }

  return {
    create,
    findAll,
    findById,
    findByCode,
    deleteById,
  };
}

// Deprecated shims — delegate to factory with shared prisma. Delete in Phase 18.
export async function create(data: { code: string; name: string }): Promise<TrackingLink> {
  return createTrackingRepository(getPrisma()).create(data);
}

export async function findAll(): Promise<
  {
    id: string;
    code: string;
    name: string;
    createdAt: Date;
    registrations: number;
    lastRegistration: Date | null;
  }[]
> {
  return createTrackingRepository(getPrisma()).findAll();
}

export async function findById(id: string): Promise<TrackingLink | null> {
  return createTrackingRepository(getPrisma()).findById(id);
}

export async function findByCode(code: string): Promise<TrackingLink | null> {
  return createTrackingRepository(getPrisma()).findByCode(code);
}

export async function deleteById(id: string): Promise<void> {
  return createTrackingRepository(getPrisma()).deleteById(id);
}
