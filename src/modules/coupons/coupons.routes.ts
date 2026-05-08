import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { validateBody, validateQuery, validateParams } from '../../shared/middleware/validation';
import type { CouponsService } from './coupons.service';
import {
  createCouponSchema,
  validateCouponSchema,
  couponQuerySchema,
  couponIdSchema,
} from './coupons.types';

export interface CouponRoutesDeps {
  service: CouponsService;
  authenticate: preHandlerAsyncHookHandler;
}

export interface AdminCouponRoutesDeps extends CouponRoutesDeps {
  requireAdmin: (req: FastifyRequest) => void | Promise<void>;
}

export function createCouponRoutes(deps: CouponRoutesDeps): FastifyPluginAsync {
  const { service, authenticate } = deps;
  return async (app) => {
    app.post(
      '/validate',
      { preHandler: [authenticate] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = validateBody(validateCouponSchema, request.body);
        const result = await service.validateCoupon(body.code, body.orderAmount);
        return reply.status(StatusCodes.OK).send(result);
      },
    );
  };
}

export function createAdminCouponRoutes(deps: AdminCouponRoutesDeps): FastifyPluginAsync {
  const { service, authenticate, requireAdmin } = deps;
  return async (app) => {
    app.addHook('preHandler', authenticate);
    app.addHook('preHandler', async (req) => requireAdmin(req));

    app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = validateBody(createCouponSchema, request.body);
      const result = await service.createCoupon(body);
      return reply.status(StatusCodes.CREATED).send(result);
    });

    app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = validateQuery(couponQuerySchema, request.query);
      const result = await service.listCoupons(query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.delete('/:couponId', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = validateParams(couponIdSchema, request.params);
      await service.deactivateCoupon(params.couponId);
      return reply.status(StatusCodes.NO_CONTENT).send();
    });
  };
}
