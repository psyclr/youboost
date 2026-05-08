import { createTrackingRepository } from '../tracking.repository';
import type { PrismaClient } from '../../../generated/prisma';

function createFakePrisma(): {
  prisma: PrismaClient;
  mocks: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    delete: jest.Mock;
    groupBy: jest.Mock;
  };
} {
  const create = jest.fn();
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const del = jest.fn();
  const groupBy = jest.fn();
  const prisma = {
    trackingLink: { create, findMany, findUnique, delete: del },
    user: { groupBy },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as PrismaClient;
  return { prisma, mocks: { create, findMany, findUnique, delete: del, groupBy } };
}

const mockLink = {
  id: 'link-1',
  code: 'promo2024',
  name: 'Promo Campaign',
  createdAt: new Date('2024-01-01'),
};

describe('Tracking Repository', () => {
  describe('create', () => {
    it('calls prisma.trackingLink.create with code and name', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue(mockLink);
      const repo = createTrackingRepository(prisma);

      const result = await repo.create({ code: 'promo2024', name: 'Promo Campaign' });

      expect(result).toEqual(mockLink);
      expect(mocks.create).toHaveBeenCalledWith({
        data: { code: 'promo2024', name: 'Promo Campaign' },
      });
    });
  });

  describe('findAll', () => {
    it('returns links with stats from groupBy', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([mockLink]);
      mocks.groupBy.mockResolvedValue([
        {
          referralCode: 'promo2024',
          _count: { id: 3 },
          _max: { createdAt: new Date('2024-06-15') },
        },
      ]);
      const repo = createTrackingRepository(prisma);

      const result = await repo.findAll();

      expect(result).toEqual([
        {
          id: 'link-1',
          code: 'promo2024',
          name: 'Promo Campaign',
          createdAt: mockLink.createdAt,
          registrations: 3,
          lastRegistration: new Date('2024-06-15'),
        },
      ]);
      expect(mocks.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
      expect(mocks.groupBy).toHaveBeenCalledWith({
        by: ['referralCode'],
        where: { referralCode: { in: ['promo2024'] } },
        _count: { id: true },
        _max: { createdAt: true },
      });
    });

    it('returns empty array when no links exist', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      const repo = createTrackingRepository(prisma);

      const result = await repo.findAll();

      expect(result).toEqual([]);
      expect(mocks.groupBy).not.toHaveBeenCalled();
    });

    it('returns zero registrations for links without stats', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([mockLink]);
      mocks.groupBy.mockResolvedValue([]);
      const repo = createTrackingRepository(prisma);

      const result = await repo.findAll();

      expect(result).toEqual([
        {
          id: 'link-1',
          code: 'promo2024',
          name: 'Promo Campaign',
          createdAt: mockLink.createdAt,
          registrations: 0,
          lastRegistration: null,
        },
      ]);
    });
  });

  describe('findById', () => {
    it('returns link when found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(mockLink);
      const repo = createTrackingRepository(prisma);

      const result = await repo.findById('link-1');

      expect(result).toEqual(mockLink);
      expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: 'link-1' } });
    });

    it('returns null when not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(null);
      const repo = createTrackingRepository(prisma);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByCode', () => {
    it('returns link when found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(mockLink);
      const repo = createTrackingRepository(prisma);

      const result = await repo.findByCode('promo2024');

      expect(result).toEqual(mockLink);
      expect(mocks.findUnique).toHaveBeenCalledWith({ where: { code: 'promo2024' } });
    });

    it('returns null when not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(null);
      const repo = createTrackingRepository(prisma);

      const result = await repo.findByCode('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('calls prisma.trackingLink.delete', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.delete.mockResolvedValue(mockLink);
      const repo = createTrackingRepository(prisma);

      await repo.deleteById('link-1');

      expect(mocks.delete).toHaveBeenCalledWith({ where: { id: 'link-1' } });
    });
  });
});
