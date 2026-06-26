import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import type { AuthService } from './auth.service';
import type { AuthEmailService } from './auth-email.service';
import type { AuthGoogleService } from './auth-google.service';
import type { AuthenticatedUser } from './auth.types';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  setPasswordSchema,
  updateProfileSchema,
} from './auth.types';

/** Name of the httpOnly cookie carrying the rotating refresh token. */
const REFRESH_COOKIE_NAME = 'youboost_rt';
/** Refresh token lifetime in seconds (mirrors JWT_REFRESH_EXPIRES_IN default '30d'). */
const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface AuthRoutesDeps {
  authService: AuthService;
  authEmailService: AuthEmailService;
  authGoogleService: AuthGoogleService;
  authenticate: preHandlerAsyncHookHandler;
  webUrl: string;
  /** Max POST /login attempts per 15-min window (env-configurable; high in dev). */
  loginRateLimitMax: number;
  /** Set the `secure` flag on auth cookies — true only in production (https). */
  cookieSecure: boolean;
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
  const {
    authService,
    authEmailService,
    authGoogleService,
    authenticate,
    webUrl,
    loginRateLimitMax,
    cookieSecure,
  } = deps;

  // Options for the httpOnly refresh-token cookie. Path "/" because the browser
  // reaches the API through the frontend /api proxy (same as oauth_nonce).
  // `secure` only in production — dev is plain http://localhost.
  const refreshCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  } as const;

  return async (app) => {
    // Register rate limit plugin
    await app.register(rateLimit, {
      global: false, // Don't apply globally, only to specific routes
    });
    // Cookie support for the OAuth browser-binding nonce
    await app.register(cookie);

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
            max: loginRateLimitMax,
            timeWindow: '15 minutes',
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const input = validateBody(loginSchema, request.body);
        const { refreshToken, ...body } = await authService.login(input);
        // Deliver the refresh token as an httpOnly cookie, not in the JSON body.
        reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
        return reply.status(StatusCodes.OK).send(body);
      },
    );

    app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
      const token = request.cookies[REFRESH_COOKIE_NAME];
      if (!token) {
        throw new UnauthorizedError('Refresh token cookie missing', 'MISSING_REFRESH_TOKEN');
      }
      const { refreshToken, ...body } = await authService.refresh(token);
      // Re-set the rotated refresh token cookie.
      reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
      return reply.status(StatusCodes.OK).send(body);
    });

    app.get(
      '/google',
      {
        config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
      },
      async (_request: FastifyRequest, reply: FastifyReply) => {
        if (!authGoogleService.isConfigured()) {
          return reply.status(StatusCodes.SERVICE_UNAVAILABLE).send({
            error: {
              code: 'GOOGLE_AUTH_NOT_CONFIGURED',
              message: 'Google sign-in is not configured',
            },
          });
        }
        const { state, nonce } = await authGoogleService.createState();
        // httpOnly nonce binds the callback to the browser that started the
        // flow (login-CSRF guard). Path "/" because the browser-visible path
        // goes through the frontend /api proxy prefix.
        reply.setCookie('oauth_nonce', nonce, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 600,
        });
        return reply.redirect(authGoogleService.buildAuthUrl(state));
      },
    );

    app.get(
      '/google/callback',
      {
        config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { code, state } = request.query as { code?: string; state?: string };
        const nonce = request.cookies['oauth_nonce'];
        reply.clearCookie('oauth_nonce', { path: '/' });
        try {
          if (!code || !state || !(await authGoogleService.consumeState(state, nonce))) {
            return reply.redirect(`${webUrl}/login?error=google`);
          }
          const profile = await authGoogleService.exchangeCode(code);
          const tokens = await authService.loginWithGoogle(profile);
          // Refresh token goes into the httpOnly cookie; the redirect fragment
          // carries only the short-lived access token.
          reply.setCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions);
          const fragment = `accessToken=${encodeURIComponent(tokens.accessToken)}`;
          return reply.redirect(`${webUrl}/auth/google/callback#${fragment}`);
        } catch {
          return reply.redirect(`${webUrl}/login?error=google`);
        }
      },
    );

    app.post(
      '/logout',
      { preHandler: [authenticate] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = getAuthUser(request);
        await authService.logout(user.userId, user.jti);
        reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
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
