import { ConflictError, NotFoundError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import * as trackingRepo from './tracking.repository';
import type { CreateTrackingLinkInput, TrackingLinkWithStats } from './tracking.types';

const log = createServiceLogger('tracking');

export async function createTrackingLink(
  input: CreateTrackingLinkInput,
): Promise<TrackingLinkWithStats> {
  const existing = await trackingRepo.findByCode(input.code);
  if (existing) {
    throw new ConflictError('Tracking link code already exists', 'TRACKING_CODE_EXISTS');
  }

  const link = await trackingRepo.create(input);
  log.info({ linkId: link.id, code: link.code }, 'Tracking link created');

  return {
    id: link.id,
    code: link.code,
    name: link.name,
    createdAt: link.createdAt,
    registrations: 0,
    lastRegistration: null,
  };
}

export async function listTrackingLinks(): Promise<TrackingLinkWithStats[]> {
  return trackingRepo.findAll();
}

export async function deleteTrackingLink(id: string): Promise<void> {
  const link = await trackingRepo.findById(id);
  if (!link) {
    throw new NotFoundError('Tracking link not found', 'TRACKING_LINK_NOT_FOUND');
  }

  await trackingRepo.deleteById(id);
  log.info({ linkId: id, code: link.code }, 'Tracking link deleted');
}
