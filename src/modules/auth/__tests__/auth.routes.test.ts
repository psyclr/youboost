import Fastify, { type FastifyInstance } from 'fastify';
import { authRoutes } from '../auth.routes';
import { AppError } from '../../../shared/errors/app-error';

const mockRegister = jest.fn();
const mockLogin = jest.fn();
const mockRefresh = jest.fn();
const mockLogout = jest.fn();
const mockGetMe = jest.fn();

jest.mock('../auth.service', () => ({
  register: (...args: unknown[]): unknown => mockRegister(...args),
  login: (...args: unknown[]): unknown => mockLogin(...args),
  refresh: (...args: unknown[]): unknown => mockRefresh(...args),
  logout: (...args: unknown[]): unknown => mockLogout(...args),
  getMe: (...args: unknown[]): unknown => mockGetMe(...args),
}));

const mockVerifyEmail = jest.fn();
const mockForgotPassword = jest.fn();
const mockResetPassword = jest.fn();

jest.mock('../auth-email.service', () => ({
  verifyEmail: (...args: unknown[]): unknown => mockVerifyEmail(...args),
  forgotPassword: (...args: unknown[]): unknown => mockForgotPassword(...args),
  resetPassword: (...args: unknown[]): unknown => mockResetPassword(...args),
}));

const mockVerifyAccessToken = jest.fn();
const mockIsBlacklisted = jest.fn();

jest.mock('../utils/tokens', () => ({
  verifyAccessToken: (...args: unknown[]): unknown => mockVerifyAccessToken(...args),
}));

jest.mock('../token.repository', () => ({
  isAccessTokenBlacklisted: (...args: unknown[]): unknown => mockIsBlacklisted(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const validUser = { userId: 'u1', email: 'a@b.com', role: 'USER', jti: 'jti-1' };

function withAuth(): Record<string, string> {
  mockVerifyAccessToken.mockReturnValue(validUser);
  mockIsBlacklisted.mockResolvedValue(false);
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

    await app.register(authRoutes, { prefix: '/auth' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
});
