import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { StatusCodes } from 'http-status-codes';
import type { ReferralsService } from './referrals.service';

export interface ReferralRoutesDeps {
  service: ReferralsService;
  authenticate: preHandlerAsyncHookHandler;
}

export function createReferralRoutes(deps: ReferralRoutesDeps): FastifyPluginAsync {
  const { service, authenticate } = deps;
  return async (app) => {
    app.get(
      '/code',
      { preHandler: [authenticate] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user) {
          return reply.status(StatusCodes.UNAUTHORIZED).send({ error: 'Unauthorized' });
        }
        const userId = request.user.userId;
        const referralCode = await service.getReferralCode(userId);
        return reply.status(StatusCodes.OK).send({ referralCode });
      },
    );

    app.get(
      '/stats',
      { preHandler: [authenticate] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user) {
          return reply.status(StatusCodes.UNAUTHORIZED).send({ error: 'Unauthorized' });
        }
        const userId = request.user.userId;
        const stats = await service.getReferralStats(userId);
        return reply.status(StatusCodes.OK).send(stats);
      },
    );
  };
}
