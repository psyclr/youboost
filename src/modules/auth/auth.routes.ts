import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import { authenticate } from './auth.middleware';
import * as authService from './auth.service';
import * as authEmailService from './auth-email.service';
import type { AuthenticatedUser } from './auth.types';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.types';

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

function getAuthUser(request: FastifyRequest): AuthenticatedUser {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedError('Authentication required', 'MISSING_USER');
  }
  return user;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = validateBody(registerSchema, request.body);
    const result = await authService.register(input);
    return reply.status(StatusCodes.CREATED).send(result);
  });

  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = validateBody(loginSchema, request.body);
    const result = await authService.login(input);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = validateBody(refreshSchema, request.body);
    const result = await authService.refresh(input.refreshToken);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.post(
    '/logout',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      await authService.logout(user.userId, user.jti);
      return reply.status(StatusCodes.NO_CONTENT).send();
    },
  );

  app.get(
    '/me',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const profile = await authService.getMe(user.userId);
      return reply.status(StatusCodes.OK).send(profile);
    },
  );

  app.post('/verify-email', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = validateBody(verifyEmailSchema, request.body);
    const result = await authEmailService.verifyEmail(input.token);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.post('/forgot-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = validateBody(forgotPasswordSchema, request.body);
    const result = await authEmailService.forgotPassword(input.email);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.post('/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = validateBody(resetPasswordSchema, request.body);
    const result = await authEmailService.resetPassword(input.token, input.newPassword);
    return reply.status(StatusCodes.OK).send(result);
  });
}
