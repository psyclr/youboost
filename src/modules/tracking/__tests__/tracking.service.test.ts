import { createTrackingService } from '../tracking.service';
import { createFakeTrackingRepository, silentLogger } from './fakes';
import type { TrackingLink } from '../../../generated/prisma';

const mockLink = {
  id: 'link-1',
  code: 'promo2024',
  name: 'Promo Campaign',
  createdAt: new Date('2024-01-01'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as TrackingLink;

describe('Tracking Service', () => {
  describe('createTrackingLink', () => {
    it('creates link and returns with zero stats', async () => {
      const trackingRepo = createFakeTrackingRepository();
      const service = createTrackingService({ trackingRepo, logger: silentLogger });

      const result = await service.createTrackingLink({
        code: 'promo2024',
        name: 'Promo Campaign',
      });

      expect(result).toMatchObject({
        code: 'promo2024',
        name: 'Promo Campaign',
        registrations: 0,
        lastRegistration: null,
      });
      expect(trackingRepo.calls.findByCode).toEqual(['promo2024']);
      expect(trackingRepo.calls.create).toEqual([{ code: 'promo2024', name: 'Promo Campaign' }]);
    });

    it('throws ConflictError when code already exists', async () => {
      const trackingRepo = createFakeTrackingRepository({ links: [mockLink] });
      const service = createTrackingService({ trackingRepo, logger: silentLogger });

      await expect(
        service.createTrackingLink({ code: 'promo2024', name: 'Promo Campaign' }),
      ).rejects.toMatchObject({ code: 'TRACKING_CODE_EXISTS' });
      expect(trackingRepo.calls.create).toHaveLength(0);
    });
  });

  describe('listTrackingLinks', () => {
    it('delegates to repo.findAll', async () => {
      const stats = [
        {
          id: 'link-1',
          code: 'promo2024',
          name: 'Promo',
          createdAt: new Date('2024-01-01'),
          registrations: 5,
          lastRegistration: new Date('2024-06-01'),
        },
      ];
      const trackingRepo = createFakeTrackingRepository({ stats });
      const service = createTrackingService({ trackingRepo, logger: silentLogger });

      const result = await service.listTrackingLinks();

      expect(result).toEqual(stats);
      expect(trackingRepo.calls.findAll).toBe(1);
    });

    it('returns empty array when no links', async () => {
      const trackingRepo = createFakeTrackingRepository();
      const service = createTrackingService({ trackingRepo, logger: silentLogger });

      const result = await service.listTrackingLinks();

      expect(result).toEqual([]);
    });
  });

  describe('deleteTrackingLink', () => {
    it('deletes link when it exists', async () => {
      const trackingRepo = createFakeTrackingRepository({ links: [mockLink] });
      const service = createTrackingService({ trackingRepo, logger: silentLogger });

      await service.deleteTrackingLink('link-1');

      expect(trackingRepo.calls.findById).toEqual(['link-1']);
      expect(trackingRepo.calls.deleteById).toEqual(['link-1']);
    });

    it('throws NotFoundError when link does not exist', async () => {
      const trackingRepo = createFakeTrackingRepository();
      const service = createTrackingService({ trackingRepo, logger: silentLogger });

      await expect(service.deleteTrackingLink('nonexistent')).rejects.toMatchObject({
        code: 'TRACKING_LINK_NOT_FOUND',
      });
      expect(trackingRepo.calls.deleteById).toHaveLength(0);
    });
  });
});
