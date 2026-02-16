import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../../shared/errors';
import { verifyAccessToken } from './utils/tokens';
import { isAccessTokenBlacklisted } from './token-store';
import type { AuthenticatedUser } from './auth.types';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
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

  const blacklisted = await isAccessTokenBlacklisted(user.jti);
  if (blacklisted) {
    throw new UnauthorizedError('Token has been revoked', 'TOKEN_REVOKED');
  }

  request.user = user;
}
