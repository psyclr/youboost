import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { authenticate } from '../auth/auth.middleware';
import * as referralsService from './referrals.service';

export async function referralRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/code',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(StatusCodes.UNAUTHORIZED).send({ error: 'Unauthorized' });
      }
      const userId = request.user.userId;
      const referralCode = await referralsService.getReferralCode(userId);
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
      const stats = await referralsService.getReferralStats(userId);
      return reply.status(StatusCodes.OK).send(stats);
    },
  );
}
