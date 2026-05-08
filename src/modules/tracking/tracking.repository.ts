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
