import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma';
import { ConflictError, NotFoundError } from '../../shared/errors';
import type { Clock } from '../../shared/utils/clock';
import type { OutboxPort } from '../../shared/outbox/outbox.port';
import type { LandingRepository } from './landing.repository';
import { presentLanding, presentListItem } from './landing.presenter';
import { buildCreateData, buildUpdateData, validateTiersUnique } from './landing.write-helpers';
import type { ServiceLookupPort } from './ports/service-lookup.port';
import type {
  AdminLandingsQuery,
  LandingCalculateInput,
  LandingCalculateResult,
  LandingCreateInput,
  LandingResponse,
  LandingUpdateInput,
  PaginatedLandings,
} from './landing.types';

export interface LandingViewContext {
  userId?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
}

export interface LandingService {
  getPublishedBySlug(slug: string, context: LandingViewContext): Promise<LandingResponse>;
  calculate(slug: string, input: LandingCalculateInput): Promise<LandingCalculateResult>;
  adminList(query: AdminLandingsQuery): Promise<PaginatedLandings>;
  adminGet(landingId: string): Promise<LandingResponse>;
  adminCreate(input: LandingCreateInput): Promise<LandingResponse>;
  adminUpdate(landingId: string, input: LandingUpdateInput): Promise<LandingResponse>;
  adminPublish(landingId: string): Promise<LandingResponse>;
  adminUnpublish(landingId: string): Promise<LandingResponse>;
  adminArchive(landingId: string): Promise<LandingResponse>;
}

export interface LandingServiceDeps {
  prisma: PrismaClient;
  landingRepo: LandingRepository;
  serviceLookup: ServiceLookupPort;
  outbox: OutboxPort;
  clock: Clock;
  logger: Logger;
}

export function createLandingService(deps: LandingServiceDeps): LandingService {
  const { prisma, landingRepo, serviceLookup, outbox, clock, logger } = deps;

  async function getPublishedBySlug(
    slug: string,
    context: LandingViewContext,
  ): Promise<LandingResponse> {
    const record = await landingRepo.findBySlug(slug);
    if (!record || record.status !== 'PUBLISHED') {
      throw new NotFoundError('Landing not found', 'LANDING_NOT_FOUND');
    }

    const response = presentLanding(record);
    await prisma.$transaction(async (tx) => {
      await outbox.emit(
        {
          type: 'landing.viewed',
          aggregateType: 'landing',
          aggregateId: record.id,
          userId: context.userId ?? null,
          payload: {
            landingId: record.id,
            slug: record.slug,
            ...(context.userAgent ? { userAgent: context.userAgent } : {}),
            ...(context.referrer ? { referrer: context.referrer } : {}),
          },
        },
        tx,
      );
    });
    logger.debug({ landingId: record.id, slug: record.slug }, 'landing viewed');
    return response;
  }

  async function calculate(
    slug: string,
    input: LandingCalculateInput,
  ): Promise<LandingCalculateResult> {
    const landing = await landingRepo.findBySlug(slug);
    if (!landing || landing.status !== 'PUBLISHED') {
      throw new NotFoundError('Landing not found', 'LANDING_NOT_FOUND');
    }
    const tier = landing.tiers.find((t) => t.serviceId === input.serviceId);
    if (!tier) {
      return {
        valid: false,
        price: null,
        serviceId: input.serviceId,
        quantity: input.quantity,
        reason: 'SERVICE_NOT_ON_LANDING',
      };
    }
    let service;
    try {
      service = await serviceLookup.getService(input.serviceId);
    } catch {
      return {
        valid: false,
        price: null,
        serviceId: input.serviceId,
        quantity: input.quantity,
        reason: 'SERVICE_NOT_FOUND',
      };
    }
    if (input.quantity < service.minQuantity) {
      return {
        valid: false,
        price: null,
        serviceId: input.serviceId,
        quantity: input.quantity,
        reason: `QUANTITY_BELOW_MIN:${service.minQuantity}`,
      };
    }
    if (input.quantity > service.maxQuantity) {
      return {
        valid: false,
        price: null,
        serviceId: input.serviceId,
        quantity: input.quantity,
        reason: `QUANTITY_ABOVE_MAX:${service.maxQuantity}`,
      };
    }
    const price = Math.round(((service.pricePer1000 * input.quantity) / 1000) * 100) / 100;
    await prisma.$transaction(async (tx) => {
      await outbox.emit(
        {
          type: 'landing.calculator_used',
          aggregateType: 'landing',
          aggregateId: landing.id,
          userId: null,
          payload: {
            landingId: landing.id,
            slug: landing.slug,
            serviceId: input.serviceId,
            quantity: input.quantity,
            computedPrice: price,
          },
        },
        tx,
      );
    });
    logger.debug(
      { landingId: landing.id, serviceId: input.serviceId, quantity: input.quantity, price },
      'landing calculator used',
    );
    return {
      valid: true,
      price,
      serviceId: input.serviceId,
      quantity: input.quantity,
      reason: null,
    };
  }

  async function adminList(query: AdminLandingsQuery): Promise<PaginatedLandings> {
    const { landings, total } = await landingRepo.list({
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
    return {
      landings: landings.map(presentListItem),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async function adminGet(landingId: string): Promise<LandingResponse> {
    const record = await landingRepo.findById(landingId);
    if (!record) {
      throw new NotFoundError('Landing not found', 'LANDING_NOT_FOUND');
    }
    return presentLanding(record);
  }

  async function adminCreate(input: LandingCreateInput): Promise<LandingResponse> {
    const existing = await landingRepo.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError('Landing with this slug already exists', 'LANDING_SLUG_CONFLICT');
    }
    validateTiersUnique(input.tiers);
    const record = await landingRepo.create(buildCreateData(input));
    logger.info({ landingId: record.id, slug: record.slug }, 'landing created');
    return presentLanding(record);
  }

  async function adminUpdate(
    landingId: string,
    input: LandingUpdateInput,
  ): Promise<LandingResponse> {
    const existing = await landingRepo.findById(landingId);
    if (!existing) {
      throw new NotFoundError('Landing not found', 'LANDING_NOT_FOUND');
    }
    if (input.slug && input.slug !== existing.slug) {
      const slugClash = await landingRepo.findBySlug(input.slug);
      if (slugClash && slugClash.id !== landingId) {
        throw new ConflictError('Landing with this slug already exists', 'LANDING_SLUG_CONFLICT');
      }
    }
    if (input.tiers) {
      validateTiersUnique(input.tiers);
    }
    const record = await landingRepo.update(landingId, buildUpdateData(input));
    logger.info({ landingId }, 'landing updated');
    return presentLanding(record);
  }

  async function adminPublish(landingId: string): Promise<LandingResponse> {
    const existing = await landingRepo.findById(landingId);
    if (!existing) throw new NotFoundError('Landing not found', 'LANDING_NOT_FOUND');
    const record = await landingRepo.setStatus(landingId, 'PUBLISHED', clock.now());
    logger.info({ landingId, slug: record.slug }, 'landing published');
    return presentLanding(record);
  }

  async function adminUnpublish(landingId: string): Promise<LandingResponse> {
    const existing = await landingRepo.findById(landingId);
    if (!existing) throw new NotFoundError('Landing not found', 'LANDING_NOT_FOUND');
    const record = await landingRepo.setStatus(landingId, 'DRAFT', null);
    logger.info({ landingId }, 'landing unpublished');
    return presentLanding(record);
  }

  async function adminArchive(landingId: string): Promise<LandingResponse> {
    const existing = await landingRepo.findById(landingId);
    if (!existing) throw new NotFoundError('Landing not found', 'LANDING_NOT_FOUND');
    const record = await landingRepo.setStatus(landingId, 'ARCHIVED', null);
    logger.info({ landingId }, 'landing archived');
    return presentLanding(record);
  }

  return {
    getPublishedBySlug,
    calculate,
    adminList,
    adminGet,
    adminCreate,
    adminUpdate,
    adminPublish,
    adminUnpublish,
    adminArchive,
  };
}
