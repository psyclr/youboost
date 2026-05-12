import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import type { AuthService } from './auth.service';
import type { AuthEmailService } from './auth-email.service';
import type { AuthenticatedUser } from './auth.types';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  setPasswordSchema,
  updateProfileSchema,
} from './auth.types';

export interface AuthRoutesDeps {
  authService: AuthService;
  authEmailService: AuthEmailService;
  authenticate: preHandlerAsyncHookHandler;
}

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

export function createAuthRoutes(deps: AuthRoutesDeps): FastifyPluginAsync {
  const { authService, authEmailService, authenticate } = deps;

  return async (app) => {
    // Register rate limit plugin
    await app.register(rateLimit, {
      global: false, // Don't apply globally, only to specific routes
    });

    app.post(
      '/register',
      {
        config: {
          rateLimit: {
            max: 5,
            timeWindow: '15 minutes',
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const input = validateBody(registerSchema, request.body);
        const result = await authService.register(input);
        return reply.status(StatusCodes.CREATED).send(result);
      },
    );

    app.post(
      '/login',
      {
        config: {
          rateLimit: {
            max: 10,
            timeWindow: '15 minutes',
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const input = validateBody(loginSchema, request.body);
        const result = await authService.login(input);
        return reply.status(StatusCodes.OK).send(result);
      },
    );

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

    app.post(
      '/forgot-password',
      {
        config: {
          rateLimit: {
            max: 3,
            timeWindow: '15 minutes',
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const input = validateBody(forgotPasswordSchema, request.body);
        const result = await authEmailService.forgotPassword(input.email);
        return reply.status(StatusCodes.OK).send(result);
      },
    );

    app.post('/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
      const input = validateBody(resetPasswordSchema, request.body);
      const result = await authEmailService.resetPassword(input.token, input.newPassword);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.post(
      '/set-password',
      {
        config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const input = validateBody(setPasswordSchema, request.body);
        const result = await authService.setPasswordViaAutoUserToken(
          input.token,
          input.newPassword,
        );
        return reply.status(StatusCodes.OK).send(result);
      },
    );

    app.put(
      '/profile',
      { preHandler: [authenticate] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = getAuthUser(request);
        const input = validateBody(updateProfileSchema, request.body);
        const result = await authService.updateProfile(user.userId, input);
        return reply.status(StatusCodes.OK).send(result);
      },
    );
  };
}
