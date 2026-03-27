import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import { authenticate } from '../auth/auth.middleware';
import * as notificationsService from './notifications.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { notificationsQuerySchema, notificationIdSchema } from './notifications.types';

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

function getAuthUser(request: FastifyRequest): AuthenticatedUser {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedError('Authentication required', 'MISSING_USER');
  }
  return user;
}

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const query = validateQuery(notificationsQuerySchema, request.query);
    const result = await notificationsService.listNotifications(user.userId, query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.get('/:notificationId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const params = validateParams(notificationIdSchema, request.params);
    const result = await notificationsService.getNotification(params.notificationId, user.userId);
    return reply.status(StatusCodes.OK).send(result);
  });
}
