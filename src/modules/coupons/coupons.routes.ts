import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { ValidationError } from '../../shared/errors';
import { authenticate } from '../auth/auth.middleware';
import { requireAdmin } from '../providers/providers.middleware';
import * as couponsService from './coupons.service';
import {
  createCouponSchema,
  validateCouponSchema,
  couponQuerySchema,
  couponIdSchema,
} from './coupons.types';

function validateBody<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } };
  },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', result.error?.issues);
  }
  return result.data as T;
}

function validateQuery<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } };
  },
  query: unknown,
): T {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', result.error?.issues);
  }
  return result.data as T;
}

function validateParams<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } };
  },
  params: unknown,
): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', result.error?.issues);
  }
  return result.data as T;
}

// User-facing routes
export async function couponRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/validate',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = validateBody(validateCouponSchema, request.body);
      const result = await couponsService.validateCoupon(body.code, body.orderAmount);
      return reply.status(StatusCodes.OK).send(result);
    },
  );
}

// Admin routes
export async function adminCouponRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', async (req) => requireAdmin(req));

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = validateBody(createCouponSchema, request.body);
    const result = await couponsService.createCoupon(body);
    return reply.status(StatusCodes.CREATED).send(result);
  });

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = validateQuery(couponQuerySchema, request.query);
    const result = await couponsService.listCoupons(query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.delete('/:couponId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = validateParams(couponIdSchema, request.params);
    await couponsService.deactivateCoupon(params.couponId);
    return reply.status(StatusCodes.NO_CONTENT).send();
  });
}
