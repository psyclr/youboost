import type { preHandlerAsyncHookHandler } from 'fastify';

export type { AuthService, AuthServiceDeps } from './auth.service';
export { createAuthService } from './auth.service';
export type { AuthEmailService, AuthEmailServiceDeps } from './auth-email.service';
export { createAuthEmailService } from './auth-email.service';
export type { UserRepository } from './user.repository';
export { createUserRepository } from './user.repository';
export type { TokenRepository } from './token.repository';
export { createTokenRepository } from './token.repository';
export type { EmailTokenRepository, EmailTokenType } from './email-token.repository';
export { createEmailTokenRepository } from './email-token.repository';
export type { AuthMiddlewareDeps } from './auth.middleware';
export { createAuthenticate } from './auth.middleware';
export type {
  AuthenticatedUser,
  TokenPair,
  UserProfile,
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
} from './auth.types';

// Transitional shim: export a lazily-built authenticate for unconverted callers.
// The shim relies on the top-level `isAccessTokenBlacklisted` export in
// `./token.repository`, which keeps external tests (billing/orders/providers
// routes) that `jest.mock('../../auth/token.repository')` working.
// Delete in sweep phase F17 once all callers switch to `createAuthenticate`.
import { createAuthenticate } from './auth.middleware';
import { isAccessTokenBlacklisted } from './token.repository';
import type { TokenRepository } from './token.repository';

let _authenticate: preHandlerAsyncHookHandler | null = null;
function getAuthenticate(): preHandlerAsyncHookHandler {
  if (!_authenticate) {
    const tokenStore = { isAccessTokenBlacklisted } as unknown as TokenRepository;
    _authenticate = createAuthenticate({ tokenStore });
  }
  return _authenticate;
}

export const authenticate: preHandlerAsyncHookHandler = async function (this, req, reply) {
  await getAuthenticate().call(this, req, reply);
};

// Transitional namespace re-export for unconverted callers (admin-users.service).
// Only the subset of `user.repository` functions still required externally is
// kept as top-level shims in that module. Delete when admin converts (F16).
export * as userRepo from './user.repository';
