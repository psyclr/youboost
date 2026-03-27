import { createTrackingLink, listTrackingLinks, deleteTrackingLink } from '../tracking.service';

const mockFindByCode = jest.fn();
const mockCreate = jest.fn();
const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockDeleteById = jest.fn();

jest.mock('../tracking.repository', () => ({
  findByCode: (...args: unknown[]): unknown => mockFindByCode(...args),
  create: (...args: unknown[]): unknown => mockCreate(...args),
  findAll: (...args: unknown[]): unknown => mockFindAll(...args),
  findById: (...args: unknown[]): unknown => mockFindById(...args),
  deleteById: (...args: unknown[]): unknown => mockDeleteById(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockLink = {
  id: 'link-1',
  code: 'promo2024',
  name: 'Promo Campaign',
  createdAt: new Date('2024-01-01'),
};

describe('Tracking Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTrackingLink', () => {
    it('should create link and return with stats', async () => {
      mockFindByCode.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockLink);

      const result = await createTrackingLink({ code: 'promo2024', name: 'Promo Campaign' });

      expect(result).toEqual({
        id: 'link-1',
        code: 'promo2024',
        name: 'Promo Campaign',
        createdAt: mockLink.createdAt,
        registrations: 0,
        lastRegistration: null,
      });
      expect(mockFindByCode).toHaveBeenCalledWith('promo2024');
      expect(mockCreate).toHaveBeenCalledWith({ code: 'promo2024', name: 'Promo Campaign' });
    });

    it('should throw ConflictError when code already exists', async () => {
      mockFindByCode.mockResolvedValue(mockLink);

      await expect(
        createTrackingLink({ code: 'promo2024', name: 'Promo Campaign' }),
      ).rejects.toThrow('Tracking link code already exists');

      await expect(
        createTrackingLink({ code: 'promo2024', name: 'Promo Campaign' }),
      ).rejects.toMatchObject({ code: 'TRACKING_CODE_EXISTS' });

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('listTrackingLinks', () => {
    it('should delegate to repo.findAll', async () => {
      const links = [{ ...mockLink, registrations: 5, lastRegistration: new Date('2024-06-01') }];
      mockFindAll.mockResolvedValue(links);

      const result = await listTrackingLinks();

      expect(result).toEqual(links);
      expect(mockFindAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no links exist', async () => {
      mockFindAll.mockResolvedValue([]);

      const result = await listTrackingLinks();

      expect(result).toEqual([]);
    });
  });

  describe('deleteTrackingLink', () => {
    it('should delete link when it exists', async () => {
      mockFindById.mockResolvedValue(mockLink);
      mockDeleteById.mockResolvedValue(undefined);

      await deleteTrackingLink('link-1');

      expect(mockFindById).toHaveBeenCalledWith('link-1');
      expect(mockDeleteById).toHaveBeenCalledWith('link-1');
    });

    it('should throw NotFoundError when link does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(deleteTrackingLink('nonexistent')).rejects.toThrow('Tracking link not found');

      await expect(deleteTrackingLink('nonexistent')).rejects.toMatchObject({
        code: 'TRACKING_LINK_NOT_FOUND',
      });

      expect(mockDeleteById).not.toHaveBeenCalled();
    });
  });
});
