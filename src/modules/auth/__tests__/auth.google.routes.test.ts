import Fastify from 'fastify';
import { createAuthRoutes } from '../auth.routes';

function buildApp(over: Record<string, unknown> = {}) {
  const authGoogleService = {
    isConfigured: jest.fn().mockReturnValue(true),
    createState: jest.fn().mockResolvedValue({ state: 'st-1', nonce: 'n-1' }),
    consumeState: jest.fn().mockResolvedValue(true),
    buildAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/auth?state=st-1'),
    exchangeCode: jest
      .fn()
      .mockResolvedValue({ googleId: 'g', email: 'e@x.com', emailVerified: true }),
    ...over,
  };
  const authService = {
    loginWithGoogle: jest.fn().mockResolvedValue({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresIn: 3600,
      tokenType: 'Bearer',
    }),
  };
  const app = Fastify();
  app.register(
    createAuthRoutes({
      authService: authService as never,
      authEmailService: {} as never,
      authGoogleService: authGoogleService as never,
      authenticate: (async () => {}) as never,
      webUrl: 'http://web',
    }),
    { prefix: '/auth' },
  );
  return { app, authGoogleService, authService };
}

describe('GET /auth/google', () => {
  it('redirects to the Google auth URL and sets the browser nonce cookie', async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/google' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
    const setCookie = res.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
    expect(cookieStr).toContain('oauth_nonce=n-1');
    expect(cookieStr).toContain('HttpOnly');
    expect(cookieStr).toContain('SameSite=Lax');
  });

  it('returns 503 when Google OAuth is not configured', async () => {
    const { app } = buildApp({ isConfigured: jest.fn().mockReturnValue(false) });
    const res = await app.inject({ method: 'GET', url: '/auth/google' });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('GOOGLE_AUTH_NOT_CONFIGURED');
  });
});

describe('GET /auth/google/callback', () => {
  it('redirects to web with tokens in the fragment when state+nonce match', async () => {
    const { app, authGoogleService } = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/google/callback?code=c&state=st-1',
      cookies: { oauth_nonce: 'n-1' },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(
      'http://web/auth/google/callback#accessToken=AT&refreshToken=RT',
    );
    expect(authGoogleService.consumeState).toHaveBeenCalledWith('st-1', 'n-1');
  });

  it('redirects to /login?error=google when the browser nonce cookie is missing (login-CSRF guard)', async () => {
    const { app, authGoogleService } = buildApp({
      consumeState: jest.fn().mockResolvedValue(false),
    });
    const res = await app.inject({
      method: 'GET',
      url: '/auth/google/callback?code=c&state=st-1',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('http://web/login?error=google');
    expect(authGoogleService.consumeState).toHaveBeenCalledWith('st-1', undefined);
  });

  it('redirects to /login?error=google when state is invalid', async () => {
    const { app } = buildApp({ consumeState: jest.fn().mockResolvedValue(false) });
    const res = await app.inject({
      method: 'GET',
      url: '/auth/google/callback?code=c&state=bad',
      cookies: { oauth_nonce: 'n-1' },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('http://web/login?error=google');
  });

  it('redirects to /login?error=google when code exchange throws', async () => {
    const { app } = buildApp({ exchangeCode: jest.fn().mockRejectedValue(new Error('boom')) });
    const res = await app.inject({
      method: 'GET',
      url: '/auth/google/callback?code=c&state=st-1',
      cookies: { oauth_nonce: 'n-1' },
    });
    expect(res.headers.location).toBe('http://web/login?error=google');
  });
});
