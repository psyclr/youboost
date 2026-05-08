import Fastify, { type FastifyInstance, type preHandlerAsyncHookHandler } from 'fastify';
import { createAuthRoutes } from '../auth.routes';
import { AppError } from '../../../shared/errors/app-error';
import { UnauthorizedError } from '../../../shared/errors';
import type { AuthService } from '../auth.service';
import type { AuthEmailService } from '../auth-email.service';

const mockRegister = jest.fn();
const mockLogin = jest.fn();
const mockRefresh = jest.fn();
const mockLogout = jest.fn();
const mockGetMe = jest.fn();
const mockUpdateProfile = jest.fn();

const mockVerifyEmail = jest.fn();
const mockForgotPassword = jest.fn();
const mockResetPassword = jest.fn();
const mockSendVerificationEmail = jest.fn();

const validUser = { userId: 'u1', email: 'a@b.com', role: 'USER', jti: 'jti-1' };
let authShouldSucceed = true;

const authenticate: preHandlerAsyncHookHandler = async (request, _reply) => {
  if (!authShouldSucceed) {
    throw new UnauthorizedError('Missing or invalid Authorization header', 'MISSING_TOKEN');
  }
  (request as unknown as { user: typeof validUser }).user = validUser;
};

function makeAuthService(): AuthService {
  return {
    register: mockRegister,
    login: mockLogin,
    refresh: mockRefresh,
    logout: mockLogout,
    getMe: mockGetMe,
    updateProfile: mockUpdateProfile,
  } as unknown as AuthService;
}

function makeAuthEmailService(): AuthEmailService {
  return {
    verifyEmail: mockVerifyEmail,
    forgotPassword: mockForgotPassword,
    resetPassword: mockResetPassword,
    sendVerificationEmail: mockSendVerificationEmail,
  } as unknown as AuthEmailService;
}

function withAuth(): Record<string, string> {
  authShouldSucceed = true;
  return { authorization: 'Bearer valid-token' };
}

describe('Auth Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.setErrorHandler((error: Error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    });

    await app.register(
      createAuthRoutes({
        authService: makeAuthService(),
        authEmailService: makeAuthEmailService(),
        authenticate,
      }),
      { prefix: '/auth' },
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authShouldSucceed = true;
  });

  describe('POST /auth/register', () => {
    it('should return 201 on successful registration', async () => {
      mockRegister.mockResolvedValue({ userId: 'u1', email: 'a@b.com', username: 'testuser' });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'a@b.com', password: 'Password1', username: 'testuser' },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).userId).toBe('u1');
    });

    it('should return 422 on invalid input', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'bad', password: 'short', username: 'ab' },
      });

      expect(res.statusCode).toBe(422);
    });
  });

  describe('POST /auth/login', () => {
    it('should return 200 with token pair', async () => {
      mockLogin.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'a@b.com', password: 'Password1' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).accessToken).toBe('at');
    });

    it('should return 422 on missing email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { password: 'x' },
      });

      expect(res.statusCode).toBe(422);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 200 with new access token', async () => {
      mockRefresh.mockResolvedValue({
        accessToken: 'new-at',
        refreshToken: 'new-rt',
        expiresIn: 3600,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: 'old-rt' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).accessToken).toBe('new-at');
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 204 when authenticated', async () => {
      const headers = withAuth();
      mockLogout.mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers,
      });

      expect(res.statusCode).toBe(204);
      expect(mockLogout).toHaveBeenCalledWith('u1', 'jti-1');
    });

    it('should return 401 without token', async () => {
      authShouldSucceed = false;
      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return 200 with user profile', async () => {
      const headers = withAuth();
      mockGetMe.mockResolvedValue({
        userId: 'u1',
        email: 'a@b.com',
        username: 'testuser',
        role: 'USER',
        emailVerified: false,
        createdAt: new Date().toISOString(),
      });

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).userId).toBe('u1');
    });

    it('should return 401 without token', async () => {
      authShouldSucceed = false;
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /auth/verify-email', () => {
    it('should return 200 on valid token', async () => {
      mockVerifyEmail.mockResolvedValue({ success: true });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { token: 'valid-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it('should return 422 on empty token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { token: '' },
      });

      expect(res.statusCode).toBe(422);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should return 200', async () => {
      mockForgotPassword.mockResolvedValue({ success: true });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: 'a@b.com' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should return 200 on valid reset', async () => {
      mockResetPassword.mockResolvedValue({ success: true });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token: 'reset-token', newPassword: 'NewPassword1' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it('should return 422 on weak password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token: 'reset-token', newPassword: 'weak' },
      });

      expect(res.statusCode).toBe(422);
    });
  });

  describe('PUT /auth/profile', () => {
    it('should return 200 when authenticated', async () => {
      const headers = withAuth();
      mockUpdateProfile.mockResolvedValue({
        userId: 'u1',
        email: 'a@b.com',
        username: 'new_name',
        role: 'USER',
        emailVerified: false,
        createdAt: new Date().toISOString(),
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/auth/profile',
        headers,
        payload: { username: 'new_name' },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpdateProfile).toHaveBeenCalledWith('u1', { username: 'new_name' });
    });
  });
});
