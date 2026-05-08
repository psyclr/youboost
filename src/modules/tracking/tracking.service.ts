import type { Logger } from 'pino';
import { ConflictError, NotFoundError } from '../../shared/errors';
import type { TrackingRepository } from './tracking.repository';
import type { CreateTrackingLinkInput, TrackingLinkWithStats } from './tracking.types';

export interface TrackingService {
  createTrackingLink(input: CreateTrackingLinkInput): Promise<TrackingLinkWithStats>;
  listTrackingLinks(): Promise<TrackingLinkWithStats[]>;
  deleteTrackingLink(id: string): Promise<void>;
}

export interface TrackingServiceDeps {
  trackingRepo: TrackingRepository;
  logger: Logger;
}

export function createTrackingService(deps: TrackingServiceDeps): TrackingService {
  const { trackingRepo, logger } = deps;

  async function createTrackingLink(
    input: CreateTrackingLinkInput,
  ): Promise<TrackingLinkWithStats> {
    const existing = await trackingRepo.findByCode(input.code);
    if (existing) {
      throw new ConflictError('Tracking link code already exists', 'TRACKING_CODE_EXISTS');
    }

    const link = await trackingRepo.create(input);
    logger.info({ linkId: link.id, code: link.code }, 'Tracking link created');

    return {
      id: link.id,
      code: link.code,
      name: link.name,
      createdAt: link.createdAt,
      registrations: 0,
      lastRegistration: null,
    };
  }

  async function listTrackingLinks(): Promise<TrackingLinkWithStats[]> {
    return trackingRepo.findAll();
  }

  async function deleteTrackingLink(id: string): Promise<void> {
    const link = await trackingRepo.findById(id);
    if (!link) {
      throw new NotFoundError('Tracking link not found', 'TRACKING_LINK_NOT_FOUND');
    }

    await trackingRepo.deleteById(id);
    logger.info({ linkId: id, code: link.code }, 'Tracking link deleted');
  }

  return { createTrackingLink, listTrackingLinks, deleteTrackingLink };
}
