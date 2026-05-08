import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError } from '../../shared/errors';
import { validateQuery, validateParams } from '../../shared/middleware/validation';
import type { AuthenticatedUser } from '../auth';
import type { NotificationsService } from './notifications.service';
import { notificationsQuerySchema, notificationIdSchema } from './notifications.types';

export interface NotificationRoutesDeps {
  service: NotificationsService;
  authenticate: preHandlerAsyncHookHandler;
}

function getAuthUser(request: FastifyRequest): AuthenticatedUser {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedError('Authentication required', 'MISSING_USER');
  }
  return user;
}

export function createNotificationRoutes(deps: NotificationRoutesDeps): FastifyPluginAsync {
  const { service, authenticate } = deps;
  return async (app) => {
    app.addHook('preHandler', authenticate);

    app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const query = validateQuery(notificationsQuerySchema, request.query);
      const result = await service.listNotifications(user.userId, query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.get('/:notificationId', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const params = validateParams(notificationIdSchema, request.params);
      const result = await service.getNotification(params.notificationId, user.userId);
      return reply.status(StatusCodes.OK).send(result);
    });
  };
}
