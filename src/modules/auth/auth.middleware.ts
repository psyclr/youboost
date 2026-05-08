import type { preHandlerAsyncHookHandler } from 'fastify';
import { UnauthorizedError } from '../../shared/errors';
import { verifyAccessToken } from './utils/tokens';
import type { TokenRepository } from './token.repository';
import type { AuthenticatedUser } from './auth.types';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export interface AuthMiddlewareDeps {
  tokenStore: TokenRepository;
}

export function createAuthenticate(deps: AuthMiddlewareDeps): preHandlerAsyncHookHandler {
  const { tokenStore } = deps;

  return async (request, _reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header', 'MISSING_TOKEN');
    }

    const token = authHeader.slice(7);

    let user: AuthenticatedUser;
    try {
      user = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired access token', 'INVALID_TOKEN');
    }

    const blacklisted = await tokenStore.isAccessTokenBlacklisted(user.jti);
    if (blacklisted) {
      throw new UnauthorizedError('Token has been revoked', 'TOKEN_REVOKED');
    }

    request.user = user;
  };
}
