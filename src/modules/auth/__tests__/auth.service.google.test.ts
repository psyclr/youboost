import { createAuthService } from '../auth.service';

function deps(overrides: Partial<Record<string, unknown>> = {}) {
  const userRepo = {
    findByEmail: jest.fn(),
    findByUsername: jest.fn().mockResolvedValue(null),
    findByGoogleId: jest.fn(),
    createGoogleUser: jest.fn(),
    linkGoogleId: jest.fn(),
    findById: jest.fn(),
  };
  const tokenStore = { saveRefreshToken: jest.fn() };
  return {
    prisma: {} as never,
    userRepo: userRepo as never,
    tokenStore: tokenStore as never,
    emailTokenRepo: {} as never,
    outbox: {} as never,
    autoUser: { createAutoUser: jest.fn(), setPasswordViaAutoUserToken: jest.fn() } as never,
    appUrl: 'http://localhost:3000',
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never,
    _userRepo: userRepo,
    _tokenStore: tokenStore,
    ...overrides,
  };
}

const profile = { googleId: 'g-1', email: 'x@y.com', emailVerified: true };

describe('loginWithGoogle', () => {
  it('issues tokens for a user found by googleId', async () => {
    const d = deps();
    d._userRepo.findByGoogleId.mockResolvedValue({
      id: 'u1',
      email: 'x@y.com',
      role: 'USER',
      status: 'ACTIVE',
    });
    const svc = createAuthService(d as never);
    const tokens = await svc.loginWithGoogle(profile);
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(d._userRepo.createGoogleUser).not.toHaveBeenCalled();
    expect(d._tokenStore.saveRefreshToken).toHaveBeenCalled();
  });

  it('links googleId when a user with that email exists', async () => {
    const d = deps();
    d._userRepo.findByGoogleId.mockResolvedValue(null);
    d._userRepo.findByEmail.mockResolvedValue({
      id: 'u2',
      email: 'x@y.com',
      role: 'USER',
      status: 'ACTIVE',
    });
    const svc = createAuthService(d as never);
    await svc.loginWithGoogle(profile);
    expect(d._userRepo.linkGoogleId).toHaveBeenCalledWith('u2', 'g-1');
    expect(d._userRepo.createGoogleUser).not.toHaveBeenCalled();
  });

  it('creates a new user when neither googleId nor email match', async () => {
    const d = deps();
    d._userRepo.findByGoogleId.mockResolvedValue(null);
    d._userRepo.findByEmail.mockResolvedValue(null);
    d._userRepo.createGoogleUser.mockResolvedValue({
      id: 'u3',
      email: 'x@y.com',
      role: 'USER',
      status: 'ACTIVE',
    });
    const svc = createAuthService(d as never);
    await svc.loginWithGoogle(profile);
    expect(d._userRepo.createGoogleUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'x@y.com', googleId: 'g-1' }),
    );
  });

  it('rejects linking by email when the Google email is unverified (account-takeover guard)', async () => {
    const d = deps();
    d._userRepo.findByGoogleId.mockResolvedValue(null);
    d._userRepo.findByEmail.mockResolvedValue({
      id: 'u2',
      email: 'x@y.com',
      role: 'USER',
      status: 'ACTIVE',
    });
    const svc = createAuthService(d as never);
    await expect(
      svc.loginWithGoogle({ ...profile, emailVerified: false }),
    ).rejects.toThrow('not verified');
    expect(d._userRepo.linkGoogleId).not.toHaveBeenCalled();
    expect(d._userRepo.createGoogleUser).not.toHaveBeenCalled();
  });

  it('rejects creating a new user when the Google email is unverified', async () => {
    const d = deps();
    d._userRepo.findByGoogleId.mockResolvedValue(null);
    d._userRepo.findByEmail.mockResolvedValue(null);
    const svc = createAuthService(d as never);
    await expect(
      svc.loginWithGoogle({ ...profile, emailVerified: false }),
    ).rejects.toThrow('not verified');
    expect(d._userRepo.createGoogleUser).not.toHaveBeenCalled();
  });

  it('still logs in an already-linked user even if emailVerified is false', async () => {
    const d = deps();
    d._userRepo.findByGoogleId.mockResolvedValue({
      id: 'u1',
      email: 'x@y.com',
      role: 'USER',
      status: 'ACTIVE',
    });
    const svc = createAuthService(d as never);
    const tokens = await svc.loginWithGoogle({ ...profile, emailVerified: false });
    expect(tokens.accessToken).toBeTruthy();
  });

  it('refuses to overwrite an existing link to a different Google account', async () => {
    const d = deps();
    d._userRepo.findByGoogleId.mockResolvedValue(null);
    d._userRepo.findByEmail.mockResolvedValue({
      id: 'u2',
      email: 'x@y.com',
      role: 'USER',
      status: 'ACTIVE',
      googleId: 'g-other',
    });
    const svc = createAuthService(d as never);
    await expect(svc.loginWithGoogle(profile)).rejects.toThrow();
    expect(d._userRepo.linkGoogleId).not.toHaveBeenCalled();
  });

  it('rejects an inactive account', async () => {
    const d = deps();
    d._userRepo.findByGoogleId.mockResolvedValue({
      id: 'u4',
      email: 'x@y.com',
      role: 'USER',
      status: 'BANNED',
    });
    const svc = createAuthService(d as never);
    await expect(svc.loginWithGoogle(profile)).rejects.toThrow();
  });
});

describe('login null-password guard', () => {
  it('rejects login when the account has no password (Google-only)', async () => {
    const d = deps();
    d._userRepo.findByEmail.mockResolvedValue({
      id: 'u5',
      email: 'x@y.com',
      role: 'USER',
      status: 'ACTIVE',
      passwordHash: null,
    });
    const svc = createAuthService(d as never);
    await expect(svc.login({ email: 'x@y.com', password: 'whatever' })).rejects.toThrow(
      'Invalid credentials',
    );
  });
});
