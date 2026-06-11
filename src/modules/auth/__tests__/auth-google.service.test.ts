import { createAuthGoogleService } from '../auth-google.service';

function redisMock() {
  const store = new Map<string, string>();
  return {
    set: jest.fn((k: string, v: string) => {
      store.set(k, v);
      return Promise.resolve('OK');
    }),
    getdel: jest.fn((k: string) => {
      const v = store.get(k) ?? null;
      store.delete(k);
      return Promise.resolve(v);
    }),
    _store: store,
  };
}

const cfg = { clientId: 'cid', clientSecret: 'secret', redirectUri: 'http://x/cb' };

describe('auth-google service: state', () => {
  it('createState stores a single-use token and consumeState validates it once', async () => {
    const redis = redisMock();
    const svc = createAuthGoogleService({
      config: cfg,
      redis: redis as never,
      oauthClient: {} as never,
    });
    const state = await svc.createState();
    expect(state).toHaveLength(64); // 32 bytes hex
    expect(redis.set).toHaveBeenCalledWith(`oauth:state:${state}`, '1', 'EX', 600);
    expect(await svc.consumeState(state)).toBe(true);
    expect(await svc.consumeState(state)).toBe(false); // single-use
  });

  it('consumeState returns false for unknown state', async () => {
    const redis = redisMock();
    const svc = createAuthGoogleService({
      config: cfg,
      redis: redis as never,
      oauthClient: {} as never,
    });
    expect(await svc.consumeState('nope')).toBe(false);
  });
});

describe('auth-google service: code exchange', () => {
  it('exchangeCode returns the verified profile', async () => {
    const redis = redisMock();
    const oauthClient = {
      getToken: jest.fn().mockResolvedValue({ tokens: { id_token: 'idt' } }),
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({ sub: 'g-1', email: 'a@b.com', email_verified: true }),
      }),
    };
    const svc = createAuthGoogleService({
      config: cfg,
      redis: redis as never,
      oauthClient: oauthClient as never,
    });
    const profile = await svc.exchangeCode('the-code');
    expect(oauthClient.getToken).toHaveBeenCalledWith('the-code');
    expect(profile).toEqual({ googleId: 'g-1', email: 'a@b.com', emailVerified: true });
  });

  it('exchangeCode throws when no email is present', async () => {
    const redis = redisMock();
    const oauthClient = {
      getToken: jest.fn().mockResolvedValue({ tokens: { id_token: 'idt' } }),
      verifyIdToken: jest.fn().mockResolvedValue({ getPayload: () => ({ sub: 'g-1' }) }),
    };
    const svc = createAuthGoogleService({
      config: cfg,
      redis: redis as never,
      oauthClient: oauthClient as never,
    });
    await expect(svc.exchangeCode('c')).rejects.toThrow();
  });
});
