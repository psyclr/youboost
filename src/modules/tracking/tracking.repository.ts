import { getPrisma } from '../../shared/database';
import type { TrackingLink } from '../../generated/prisma';

export async function create(data: { code: string; name: string }): Promise<TrackingLink> {
  const prisma = getPrisma();
  return prisma.trackingLink.create({
    data: {
      code: data.code,
      name: data.name,
    },
  });
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
  const prisma = getPrisma();

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
    stats.map((s) => [s.referralCode, { count: s._count.id, lastRegistration: s._max.createdAt }]),
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

export async function findById(id: string): Promise<TrackingLink | null> {
  const prisma = getPrisma();
  return prisma.trackingLink.findUnique({ where: { id } });
}

export async function findByCode(code: string): Promise<TrackingLink | null> {
  const prisma = getPrisma();
  return prisma.trackingLink.findUnique({ where: { code } });
}

export async function deleteById(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.trackingLink.delete({ where: { id } });
}
