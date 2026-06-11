import Fastify from 'fastify';
import { createAuthRoutes } from '../auth.routes';

function buildApp(over: Record<string, unknown> = {}) {
  const authGoogleService = {
    createState: jest.fn().mockResolvedValue('st-1'),
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
  it('redirects to the Google auth URL', async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/google' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });
});

describe('GET /auth/google/callback', () => {
  it('redirects to web with tokens in the fragment on success', async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/google/callback?code=c&state=st-1' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(
      'http://web/auth/google/callback#accessToken=AT&refreshToken=RT',
    );
  });

  it('redirects to /login?error=google when state is invalid', async () => {
    const { app } = buildApp({ consumeState: jest.fn().mockResolvedValue(false) });
    const res = await app.inject({ method: 'GET', url: '/auth/google/callback?code=c&state=bad' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('http://web/login?error=google');
  });

  it('redirects to /login?error=google when code exchange throws', async () => {
    const { app } = buildApp({ exchangeCode: jest.fn().mockRejectedValue(new Error('boom')) });
    const res = await app.inject({ method: 'GET', url: '/auth/google/callback?code=c&state=st-1' });
    expect(res.headers.location).toBe('http://web/login?error=google');
  });
});
