export type { AuthService, AuthServiceDeps, AutoUserTicket } from './auth.service';
export { createAuthService } from './auth.service';
export type { AuthAutoUserService, AuthAutoUserServiceDeps } from './auth-auto-user.service';
export { createAuthAutoUserService } from './auth-auto-user.service';
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
