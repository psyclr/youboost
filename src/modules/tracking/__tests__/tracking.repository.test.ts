import { create, findAll, findById, findByCode, deleteById } from '../tracking.repository';

const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockDelete = jest.fn();
const mockGroupBy = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    trackingLink: {
      create: (...args: unknown[]): unknown => mockCreate(...args),
      findMany: (...args: unknown[]): unknown => mockFindMany(...args),
      findUnique: (...args: unknown[]): unknown => mockFindUnique(...args),
      delete: (...args: unknown[]): unknown => mockDelete(...args),
    },
    user: {
      groupBy: (...args: unknown[]): unknown => mockGroupBy(...args),
    },
  }),
}));

const mockLink = {
  id: 'link-1',
  code: 'promo2024',
  name: 'Promo Campaign',
  createdAt: new Date('2024-01-01'),
};

describe('Tracking Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should call prisma.trackingLink.create with code and name', async () => {
      mockCreate.mockResolvedValue(mockLink);

      const result = await create({ code: 'promo2024', name: 'Promo Campaign' });

      expect(result).toEqual(mockLink);
      expect(mockCreate).toHaveBeenCalledWith({
        data: { code: 'promo2024', name: 'Promo Campaign' },
      });
    });
  });

  describe('findAll', () => {
    it('should return links with stats from groupBy', async () => {
      const links = [mockLink];
      mockFindMany.mockResolvedValue(links);
      mockGroupBy.mockResolvedValue([
        {
          referralCode: 'promo2024',
          _count: { id: 3 },
          _max: { createdAt: new Date('2024-06-15') },
        },
      ]);

      const result = await findAll();

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
      expect(mockFindMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
      expect(mockGroupBy).toHaveBeenCalledWith({
        by: ['referralCode'],
        where: { referralCode: { in: ['promo2024'] } },
        _count: { id: true },
        _max: { createdAt: true },
      });
    });

    it('should return empty array when no links exist', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await findAll();

      expect(result).toEqual([]);
      expect(mockGroupBy).not.toHaveBeenCalled();
    });

    it('should return zero registrations for links without stats', async () => {
      mockFindMany.mockResolvedValue([mockLink]);
      mockGroupBy.mockResolvedValue([]);

      const result = await findAll();

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
    it('should return link when found', async () => {
      mockFindUnique.mockResolvedValue(mockLink);

      const result = await findById('link-1');

      expect(result).toEqual(mockLink);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'link-1' } });
    });

    it('should return null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByCode', () => {
    it('should return link when found', async () => {
      mockFindUnique.mockResolvedValue(mockLink);

      const result = await findByCode('promo2024');

      expect(result).toEqual(mockLink);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { code: 'promo2024' } });
    });

    it('should return null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await findByCode('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('should call prisma.trackingLink.delete', async () => {
      mockDelete.mockResolvedValue(mockLink);

      await deleteById('link-1');

      expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'link-1' } });
    });
  });
});
