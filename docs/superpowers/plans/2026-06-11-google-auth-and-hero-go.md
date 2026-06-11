# Google Auth + Hero "Go!" → Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google sign-in/registration (server-side OAuth Authorization Code flow) and make the hero "Go!" button drop the user into the calculator with a YouTube-views service pre-added and the typed link filled in.

**Architecture:** Three independent tracks. Track A (backend) adds a Google OAuth service, a `loginWithGoogle` user-resolution path, two redirect routes, a nullable `passwordHash`, and Redis-backed CSRF `state`. Track B (frontend) adds a "Continue with Google" button, a fragment-consuming callback page, and a `setSession` auth-context method. Track C (frontend-only) wires the hero link into the cart. The session crosses the redirect boundary via a URL fragment (`#accessToken=…&refreshToken=…`), matching the existing localStorage-refresh + in-memory-access token model.

**Tech Stack:** Fastify, Prisma 7 (PostgreSQL), Redis (ioredis via `getRedis()`), `google-auth-library` (new dep), Next.js App Router, React, Tailwind v4, Jest (backend unit), Playwright (frontend e2e).

**Reference spec:** `docs/superpowers/specs/2026-06-11-google-auth-and-hero-go-design.md`

---

## File Structure

**Track A — backend (Google auth):**

- Modify `prisma/schema.prisma` — `User.passwordHash` nullable, add `User.googleId`.
- Create `prisma/migrations/<ts>_add_google_auth/migration.sql` — via `prisma migrate dev`.
- Modify `src/shared/config/env.ts` — `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `WEB_URL`.
- Create `src/modules/auth/auth-google.service.ts` — Google OAuth wrapper + Redis state store.
- Modify `src/modules/auth/user.repository.ts` — nullable `passwordHash`, `findByGoogleId`, `linkGoogleId`, `createGoogleUser`.
- Modify `src/modules/auth/auth.service.ts` — `loginWithGoogle`, null-password guards.
- Modify `src/modules/auth/auth.routes.ts` — `GET /auth/google`, `GET /auth/google/callback`.
- Modify `src/composition/register-routes.ts` + `src/app.ts` — wire the Google service + config.
- Tests under `src/modules/auth/__tests__/`.

**Track B — frontend (Google auth UI):**

- Create `frontend/src/components/auth/google-button.tsx`.
- Create `frontend/src/app/(auth)/google/callback/page.tsx`.
- Modify `frontend/src/lib/auth/auth-context.tsx` — add `setSession`.
- Modify `frontend/src/app/(auth)/login/page.tsx` + `register/page.tsx` — button + `?error=google`.
- Test `frontend/e2e/auth-google.spec.ts`.

**Track C — frontend (hero Go):**

- Modify `frontend/src/components/marketing/service-tiers.tsx`.
- Test `frontend/e2e/home-calculator.spec.ts` (extend).

---

## Coordination note

Track B depends only on the **contract** fixed here, not on Track A's code:

- Start OAuth: browser navigates to `/api/auth/google`.
- Success: backend redirects to `${WEB_URL}/auth/google/callback#accessToken=<jwt>&refreshToken=<token>`.
- Failure: backend redirects to `${WEB_URL}/login?error=google`.

All three tracks can run in parallel. Run the integration/verification section once all land.

---

# Track A — Google authentication (backend)

### Task A1: Schema — nullable passwordHash + googleId

**Files:**

- Modify: `prisma/schema.prisma` (User model, lines 16–56)
- Create: migration via CLI

- [ ] **Step 1: Edit the User model**

Change the `passwordHash` line and add `googleId` right after it:

```prisma
  passwordHash  String?    @map("password_hash") @db.VarChar(255)
  googleId      String?    @unique @map("google_id") @db.VarChar(255)
```

(Leave all other fields unchanged.)

- [ ] **Step 2: Generate the migration + client**

Run: `npx prisma migrate dev --name add_google_auth`
Expected: a new folder `prisma/migrations/<timestamp>_add_google_auth/` with `migration.sql` containing `ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL` and `ADD COLUMN "google_id"` + unique index; Prisma Client regenerated.

- [ ] **Step 3: Verify typecheck still resolves the generated client**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `user.repository.ts` / `auth.service.ts` where `passwordHash` is now `string | null` (these are fixed in A2/A3). No errors about the Prisma schema itself.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/generated/prisma
git commit -m "feat(auth): nullable passwordHash + googleId for Google sign-in"
```

---

### Task A2: User repository — Google methods + nullable type

**Files:**

- Modify: `src/modules/auth/user.repository.ts`
- Test: `src/modules/auth/__tests__/user.repository.test.ts` (create if absent; otherwise extend)

- [ ] **Step 1: Write the failing test**

Create/extend `src/modules/auth/__tests__/user.repository.test.ts`:

```typescript
import { createUserRepository } from '../user.repository';

function makePrismaMock() {
  const user = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  return { user } as never;
}

describe('UserRepository Google methods', () => {
  it('findByGoogleId queries by googleId', async () => {
    const prisma = makePrismaMock();
    (prisma as any).user.findUnique.mockResolvedValue({ id: 'u1' });
    const repo = createUserRepository(prisma);
    const found = await repo.findByGoogleId('g-123');
    expect((prisma as any).user.findUnique).toHaveBeenCalledWith({ where: { googleId: 'g-123' } });
    expect(found).toEqual({ id: 'u1' });
  });

  it('createGoogleUser creates a verified, password-less user', async () => {
    const prisma = makePrismaMock();
    (prisma as any).user.create.mockResolvedValue({ id: 'u2' });
    const repo = createUserRepository(prisma);
    await repo.createGoogleUser({ email: 'a@b.com', username: 'ab', googleId: 'g-9' });
    expect((prisma as any).user.create).toHaveBeenCalledWith({
      data: {
        email: 'a@b.com',
        username: 'ab',
        googleId: 'g-9',
        passwordHash: null,
        emailVerified: true,
      },
    });
  });

  it('linkGoogleId sets googleId on an existing user', async () => {
    const prisma = makePrismaMock();
    (prisma as any).user.update.mockResolvedValue({ id: 'u3', googleId: 'g-1' });
    const repo = createUserRepository(prisma);
    await repo.linkGoogleId('u3', 'g-1');
    expect((prisma as any).user.update).toHaveBeenCalledWith({
      where: { id: 'u3' },
      data: { googleId: 'g-1' },
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/modules/auth/__tests__/user.repository.test.ts`
Expected: FAIL — `findByGoogleId`/`createGoogleUser`/`linkGoogleId` not functions.

- [ ] **Step 3: Implement**

In `user.repository.ts`:

(a) Make the record/type nullable — change `UserRecord.passwordHash` and `CreateUserData.passwordHash`:

```typescript
type UserRecord = {
  id: string;
  email: string;
  username: string;
  passwordHash: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  isAutoCreated: boolean;
  createdAt: Date;
  updatedAt: Date;
  googleId: string | null;
};
```

(b) Add to the `UserRepository` interface:

```typescript
  findByGoogleId(googleId: string): Promise<UserRecord | null>;
  createGoogleUser(data: {
    email: string;
    username: string;
    googleId: string;
  }): Promise<UserRecord>;
  linkGoogleId(userId: string, googleId: string): Promise<void>;
```

(c) Implement inside `createUserRepository` and add to the returned object:

```typescript
async function findByGoogleId(googleId: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({ where: { googleId } });
}

async function createGoogleUser(data: {
  email: string;
  username: string;
  googleId: string;
}): Promise<UserRecord> {
  return prisma.user.create({
    data: {
      email: data.email,
      username: data.username,
      googleId: data.googleId,
      passwordHash: null,
      emailVerified: true,
    },
  });
}

async function linkGoogleId(userId: string, googleId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { googleId } });
}
```

Add `findByGoogleId, createGoogleUser, linkGoogleId` to the final `return { … }`.

- [ ] **Step 4: Run tests**

Run: `npx jest src/modules/auth/__tests__/user.repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/user.repository.ts src/modules/auth/__tests__/user.repository.test.ts
git commit -m "feat(auth): user repository Google lookup/link/create"
```

---

### Task A3: Auth service — loginWithGoogle + null-password guards

**Files:**

- Modify: `src/modules/auth/auth.service.ts`
- Test: `src/modules/auth/__tests__/auth.service.google.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/modules/auth/__tests__/auth.service.google.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/modules/auth/__tests__/auth.service.google.test.ts`
Expected: FAIL — `loginWithGoogle` is not a function.

- [ ] **Step 3: Implement**

In `auth.service.ts`:

(a) Add to the `AuthService` interface:

```typescript
  loginWithGoogle(profile: { googleId: string; email: string; emailVerified: boolean }): Promise<TokenPair>;
```

(b) Add a null guard at the top of `login`, right after the `if (!user)` block:

```typescript
if (!user.passwordHash) {
  throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
}
```

(c) Guard the password-change branch in `updateProfile` (TS now sees `passwordHash: string | null`):

```typescript
    if (input.currentPassword && input.newPassword) {
      if (!user.passwordHash) {
        throw new ValidationError('Current password is incorrect', 'INVALID_PASSWORD');
      }
      const valid = await comparePassword(input.currentPassword, user.passwordHash);
```

(d) Add a private helper for a unique username and the `loginWithGoogle` function (place near `login`):

```typescript
function sanitizeUsername(email: string): string {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  return (base || 'user').slice(0, 24);
}

async function uniqueUsername(email: string): Promise<string> {
  const base = sanitizeUsername(email);
  if (!(await userRepo.findByUsername(base))) return base;
  for (let i = 1; i < 100; i++) {
    const candidate = `${base}${i}`.slice(0, 30);
    if (!(await userRepo.findByUsername(candidate))) return candidate;
  }
  return `${base}${Date.now()}`.slice(0, 30);
}

function issueTokens(user: { id: string; email: string; role: string }): Promise<TokenPair> {
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role as 'USER' | 'RESELLER' | 'ADMIN',
  });
  const refreshToken = generateRefreshToken();
  const refreshHash = hashToken(refreshToken);
  return tokenStore
    .saveRefreshToken(user.id, refreshHash, getRefreshExpiresAt())
    .then(() => ({ accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer' as const }));
}

async function loginWithGoogle(profile: {
  googleId: string;
  email: string;
  emailVerified: boolean;
}): Promise<TokenPair> {
  let user = await userRepo.findByGoogleId(profile.googleId);
  if (!user) {
    const byEmail = await userRepo.findByEmail(profile.email);
    if (byEmail) {
      await userRepo.linkGoogleId(byEmail.id, profile.googleId);
      user = byEmail;
    } else {
      const username = await uniqueUsername(profile.email);
      user = await userRepo.createGoogleUser({
        email: profile.email,
        username,
        googleId: profile.googleId,
      });
    }
  }
  if (user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is not active', 'ACCOUNT_INACTIVE');
  }
  logger.info({ userId: user.id }, 'User logged in via Google');
  return issueTokens(user);
}
```

(e) Refactor `login` and `refresh` are optional — leave them as-is (do NOT change their token logic; `issueTokens` is only used by `loginWithGoogle` to keep the diff small). Add `loginWithGoogle` to the final `return { … }`.

- [ ] **Step 4: Run tests**

Run: `npx jest src/modules/auth/__tests__/auth.service.google.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/auth.service.ts src/modules/auth/__tests__/auth.service.google.test.ts
git commit -m "feat(auth): loginWithGoogle resolution + null-password guards"
```

---

### Task A4: Config — Google env vars

**Files:**

- Modify: `src/shared/config/env.ts`
- Modify: `src/shared/config/__tests__/env.test.ts`

- [ ] **Step 1: Add to the test fixture**

In `src/shared/config/__tests__/env.test.ts`, add to the valid-env fixture object:

```typescript
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
    WEB_URL: 'http://localhost:3001',
```

And add an assertion (place beside existing config assertions):

```typescript
expect(config.google.clientId).toBe('test-client-id');
expect(config.app.webUrl).toBe('http://localhost:3001');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/shared/config/__tests__/env.test.ts`
Expected: FAIL — `config.google` undefined.

- [ ] **Step 3: Implement**

In `env.ts`, add to `envSchema` (near the JWT block):

```typescript
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z.string().default(''),
  WEB_URL: z.string().default('http://localhost:3001'),
```

Add `webUrl: string;` to the `app` object's TS interface, set `webUrl: parsed.WEB_URL` in the `app:` block of the config object, and add a `google` block to both the `AppConfig` interface and the config object:

```typescript
    app: {
      nodeEnv: parsed.NODE_ENV,
      port: parsed.PORT,
      logLevel: parsed.LOG_LEVEL,
      url: parsed.APP_URL,
      webUrl: parsed.WEB_URL,
    },
    google: {
      clientId: parsed.GOOGLE_CLIENT_ID,
      clientSecret: parsed.GOOGLE_CLIENT_SECRET,
      redirectUri: parsed.GOOGLE_REDIRECT_URI,
    },
```

Interface additions:

```typescript
app: {
  nodeEnv: string;
  port: number;
  logLevel: string;
  url: string;
  webUrl: string;
}
google: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}
```

(Match the existing interface style in the file.)

- [ ] **Step 4: Run tests + typecheck**

Run: `npx jest src/shared/config/__tests__/env.test.ts && npx tsc --noEmit`
Expected: env test PASS. (Other auth files compile once A2/A3 are in.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/config/env.ts src/shared/config/__tests__/env.test.ts
git commit -m "feat(config): GOOGLE_* and WEB_URL env vars"
```

---

### Task A5: Google OAuth service (wrapper + Redis state)

**Files:**

- Create: `src/modules/auth/auth-google.service.ts`
- Test: `src/modules/auth/__tests__/auth-google.service.test.ts`
- Add dep: `google-auth-library`

- [ ] **Step 1: Install the dependency**

Run: `npm install google-auth-library`
Expected: added to `dependencies`.

- [ ] **Step 2: Write the failing test**

Create `src/modules/auth/__tests__/auth-google.service.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest src/modules/auth/__tests__/auth-google.service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/modules/auth/auth-google.service.ts`:

```typescript
import { randomBytes } from 'node:crypto';
import type Redis from 'ioredis';
import { OAuth2Client } from 'google-auth-library';
import { UnauthorizedError } from '../../shared/errors';

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
}

export interface AuthGoogleService {
  buildAuthUrl(state: string): string;
  createState(): Promise<string>;
  consumeState(state: string): Promise<boolean>;
  exchangeCode(code: string): Promise<GoogleProfile>;
}

export interface AuthGoogleServiceDeps {
  config: { clientId: string; clientSecret: string; redirectUri: string };
  redis: Redis;
  // Injected for testability; defaults to a real OAuth2Client in the factory below.
  oauthClient?: Pick<OAuth2Client, 'getToken' | 'verifyIdToken' | 'generateAuthUrl'>;
}

const STATE_TTL_SECONDS = 600;
const stateKey = (state: string) => `oauth:state:${state}`;

export function createAuthGoogleService(deps: AuthGoogleServiceDeps): AuthGoogleService {
  const { config, redis } = deps;
  const client =
    deps.oauthClient ?? new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);

  function buildAuthUrl(state: string): string {
    return (client as OAuth2Client).generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });
  }

  async function createState(): Promise<string> {
    const state = randomBytes(32).toString('hex');
    await redis.set(stateKey(state), '1', 'EX', STATE_TTL_SECONDS);
    return state;
  }

  async function consumeState(state: string): Promise<boolean> {
    if (!state) return false;
    const found = await redis.getdel(stateKey(state));
    return found === '1';
  }

  async function exchangeCode(code: string): Promise<GoogleProfile> {
    const { tokens } = await client.getToken(code);
    const idToken = tokens.id_token;
    if (!idToken) {
      throw new UnauthorizedError('Google did not return an id_token', 'GOOGLE_AUTH_FAILED');
    }
    const ticket = await client.verifyIdToken({ idToken, audience: config.clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedError('Google profile missing email', 'GOOGLE_AUTH_FAILED');
    }
    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
    };
  }

  return { buildAuthUrl, createState, consumeState, exchangeCode };
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/modules/auth/__tests__/auth-google.service.test.ts`
Expected: PASS (4).

- [ ] **Step 6: Commit**

```bash
git add src/modules/auth/auth-google.service.ts src/modules/auth/__tests__/auth-google.service.test.ts package.json package-lock.json
git commit -m "feat(auth): Google OAuth service with Redis-backed CSRF state"
```

---

### Task A6: Routes — GET /auth/google + /auth/google/callback

**Files:**

- Modify: `src/modules/auth/auth.routes.ts`
- Test: `src/modules/auth/__tests__/auth.google.routes.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/modules/auth/__tests__/auth.google.routes.test.ts`:

```typescript
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
    loginWithGoogle: jest
      .fn()
      .mockResolvedValue({
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/modules/auth/__tests__/auth.google.routes.test.ts`
Expected: FAIL — `authGoogleService`/`webUrl` not accepted; routes 404.

- [ ] **Step 3: Implement**

In `auth.routes.ts`:

(a) Extend imports and deps:

```typescript
import type { AuthGoogleService } from './auth-google.service';
```

```typescript
export interface AuthRoutesDeps {
  authService: AuthService;
  authEmailService: AuthEmailService;
  authGoogleService: AuthGoogleService;
  authenticate: preHandlerAsyncHookHandler;
  webUrl: string;
}
```

```typescript
const { authService, authEmailService, authGoogleService, authenticate, webUrl } = deps;
```

(b) Add the two routes inside the plugin (after `/refresh`, before `/logout`):

```typescript
app.get('/google', async (_request: FastifyRequest, reply: FastifyReply) => {
  const state = await authGoogleService.createState();
  return reply.redirect(authGoogleService.buildAuthUrl(state));
});

app.get('/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
  const { code, state } = request.query as { code?: string; state?: string };
  try {
    if (!code || !state || !(await authGoogleService.consumeState(state))) {
      return reply.redirect(`${webUrl}/login?error=google`);
    }
    const profile = await authGoogleService.exchangeCode(code);
    const tokens = await authService.loginWithGoogle(profile);
    const fragment = `accessToken=${encodeURIComponent(tokens.accessToken)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`;
    return reply.redirect(`${webUrl}/auth/google/callback#${fragment}`);
  } catch {
    return reply.redirect(`${webUrl}/login?error=google`);
  }
});
```

Note: the success test asserts the literal `accessToken=AT&refreshToken=RT`; `encodeURIComponent('AT')` is `AT`, so it matches.

- [ ] **Step 4: Run tests**

Run: `npx jest src/modules/auth/__tests__/auth.google.routes.test.ts`
Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/auth.routes.ts src/modules/auth/__tests__/auth.google.routes.test.ts
git commit -m "feat(auth): GET /auth/google + /auth/google/callback redirect routes"
```

---

### Task A7: Wire the Google service into composition

**Files:**

- Modify: `src/app.ts` (around line 198 where `authService` is built; and route registration)
- Modify: `src/composition/register-routes.ts`
- Modify: `src/modules/auth/index.ts` (export the new service factory + type)

- [ ] **Step 1: Export from the auth barrel**

In `src/modules/auth/index.ts`, add:

```typescript
export { createAuthGoogleService } from './auth-google.service';
export type { AuthGoogleService } from './auth-google.service';
```

- [ ] **Step 2: Build the service in app.ts**

In `src/app.ts`, near where `authService` is created (line ~198), add (Redis comes from the shared accessor):

```typescript
import { getRedis } from './shared/redis/redis';
import { createAuthGoogleService } from './modules/auth';
```

```typescript
const authGoogleService = createAuthGoogleService({
  config: config.google,
  redis: getRedis(),
});
```

- [ ] **Step 3: Pass it through route registration**

In `src/composition/register-routes.ts`:

- Add to `RouteRegistrationDeps`: `authGoogleService: AuthGoogleService;` and import the type from `../modules/auth`.
- Pass it into `createAuthRoutes({ … })` plus `webUrl: <config webUrl>`.

Since `register-routes.ts` doesn't currently receive config, thread `webUrl` through `RouteRegistrationDeps`:

```typescript
authGoogleService: AuthGoogleService;
webUrl: string;
```

```typescript
    createAuthRoutes({
      authService: deps.authService,
      authEmailService: deps.authEmailService,
      authGoogleService: deps.authGoogleService,
      authenticate,
      webUrl: deps.webUrl,
    }),
```

In `src/app.ts` where `registerRoutes({ … })` is called, add `authGoogleService` and `webUrl: config.app.webUrl` to the object.

- [ ] **Step 4: Verify the whole backend compiles and unit tests pass**

Run: `npx tsc --noEmit && npx jest src/modules/auth src/shared/config`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app.ts src/composition/register-routes.ts src/modules/auth/index.ts
git commit -m "feat(auth): wire Google OAuth service into composition root"
```

---

# Track B — Google authentication (frontend)

### Task B1: auth-context setSession

**Files:**

- Modify: `frontend/src/lib/auth/auth-context.tsx`

- [ ] **Step 1: Implement `setSession`**

Add a callback inside `AuthProvider` (mirrors `login`'s post-token path):

```typescript
const setSession = useCallback(async (tokens: { accessToken: string; refreshToken: string }) => {
  accessTokenRef.current = tokens.accessToken;
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  const profile = await authApi.getMe();
  setUser(profile);
}, []);
```

Add `setSession` to `AuthContextValue`:

```typescript
setSession: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
```

Add `setSession` to the `useMemo` `contextValue` object and its dependency array.

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/auth/auth-context.tsx
git commit -m "feat(frontend): auth-context setSession for external token handoff"
```

---

### Task B2: Google button component

**Files:**

- Create: `frontend/src/components/auth/google-button.tsx`

- [ ] **Step 1: Implement**

Create `frontend/src/components/auth/google-button.tsx`:

```tsx
import { Button } from '@/components/ui/button';

export function GoogleButton({ label = 'Continue with Google' }: { label?: string }) {
  return (
    <Button asChild variant="outline" className="w-full">
      <a href="/api/auth/google" aria-label={label}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="mr-2">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.92v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.92a9 9 0 0 0 0 8.1l3.06-2.33Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .92 4.95l3.06 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
        {label}
      </a>
    </Button>
  );
}
```

(If `Button` does not support `asChild`, use a plain styled `<a>` with the same classes — check `frontend/src/components/ui/button.tsx` first.)

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/auth/google-button.tsx
git commit -m "feat(frontend): GoogleButton component"
```

---

### Task B3: Callback page

**Files:**

- Create: `frontend/src/app/(auth)/google/callback/page.tsx`

- [ ] **Step 1: Implement**

Create `frontend/src/app/(auth)/google/callback/page.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export default function GoogleCallbackPage() {
  const { setSession } = useAuth();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    // Strip tokens from the URL so they don't linger in history.
    window.history.replaceState(null, '', window.location.pathname);

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=google');
      return;
    }

    setSession({ accessToken, refreshToken })
      .then(() => router.replace('/dashboard'))
      .catch(() => {
        setFailed(true);
        router.replace('/login?error=google');
      });
  }, [setSession, router]);

  return (
    <p className="text-sm text-muted-foreground" role="status">
      {failed ? 'Sign-in failed, redirecting…' : 'Completing sign-in…'}
    </p>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(auth)/google/callback/page.tsx"
git commit -m "feat(frontend): Google OAuth callback page (fragment handoff)"
```

---

### Task B4: Buttons on login + register + ?error=google

**Files:**

- Modify: `frontend/src/app/(auth)/login/page.tsx`
- Modify: `frontend/src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Login page — button + error**

In `login/page.tsx`:

- Import: `import { GoogleButton } from '@/components/auth/google-button';` and `import { useSearchParams } from 'next/navigation';`
- After `const [error, setError] = useState<string | null>(null);` add:

```tsx
const searchParams = useSearchParams();
const googleError =
  searchParams.get('error') === 'google' ? 'Google sign-in failed. Please try again.' : null;
```

- In the form, change the error banner condition to show either:

```tsx
{
  (error || googleError) && (
    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
      {error || googleError}
    </div>
  );
}
```

- After the submit `Button` (inside the `<form>`, below the Sign In button), add a divider + Google button:

```tsx
            <div className="relative py-1 text-center">
              <span className="bg-card px-2 text-xs text-muted-foreground">or</span>
            </div>
            <GoogleButton label="Sign in with Google" />
```

Note: `useSearchParams` requires a Suspense boundary in some Next setups. If `npx next build` warns, wrap the page body in `<Suspense>` per the existing pattern in the repo (check other pages using `useSearchParams`, e.g. reset-password).

- [ ] **Step 2: Register page — button**

In `register/page.tsx`, import `GoogleButton` and add the same divider + `<GoogleButton label="Sign up with Google" />` after the submit button inside the form.

- [ ] **Step 3: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/(auth)/login/page.tsx" "frontend/src/app/(auth)/register/page.tsx"
git commit -m "feat(frontend): Google button on login/register + ?error=google"
```

---

### Task B5: E2E — Google callback + error

**Files:**

- Create: `frontend/e2e/auth-google.spec.ts`

- [ ] **Step 1: Write the spec**

Create `frontend/e2e/auth-google.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Google auth UI', () => {
  test('login page shows a Continue with Google button linking to /api/auth/google', async ({
    page,
  }) => {
    await page.goto('/login');
    const link = page.getByRole('link', { name: /google/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/api/auth/google');
  });

  test('?error=google renders an inline error', async ({ page }) => {
    await page.goto('/login?error=google');
    await expect(page.getByText(/google sign-in failed/i)).toBeVisible();
  });

  test('callback page consumes a token fragment and authenticates', async ({ page }) => {
    // Mock the profile fetch the callback triggers via setSession -> getMe.
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'u1',
          email: 'g@x.com',
          username: 'g',
          role: 'USER',
          emailVerified: true,
          createdAt: new Date().toISOString(),
        }),
      }),
    );
    await page.goto('/auth/google/callback#accessToken=AT&refreshToken=RT');
    await page.waitForURL('**/dashboard');
    expect(await page.evaluate(() => localStorage.getItem('youboost_refresh_token'))).toBe('RT');
  });

  test('callback without tokens redirects to login error', async ({ page }) => {
    await page.goto('/auth/google/callback');
    await page.waitForURL('**/login?error=google');
    await expect(page.getByText(/google sign-in failed/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it**

Run (from `frontend/`): `npx playwright test auth-google`
Expected: PASS (4). This spec performs zero password logins (safe against the ≤10 budget).

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/auth-google.spec.ts
git commit -m "test(e2e): Google auth button, error banner, callback handoff"
```

---

# Track C — Hero "Go!" → calculator with YouTube views

### Task C1: Auto-add YouTube-views tier on hero link

**Files:**

- Modify: `frontend/src/components/marketing/service-tiers.tsx`
- Test: `frontend/e2e/home-calculator.spec.ts` (extend)

- [ ] **Step 1: Write the failing e2e test**

Append to `frontend/e2e/home-calculator.spec.ts` (inside the existing `describe`):

```typescript
test('6. Hero Go pre-adds a YouTube-views service with the link filled', async ({ page }) => {
  await page.goto('/');
  const heroInput = page.getByLabel('Link to your video or channel');
  await heroInput.fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Go', exact: true }).click();

  // Order panel now has one item whose link is pre-filled.
  const panel = page.getByLabel('Order panel');
  await expect(panel.getByDisplayValue('https://youtu.be/dQw4w9WgXcQ')).toBeVisible();
  // Platform tab switched to YouTube (its button is active/visible in the catalog).
  await expect(page.getByRole('button', { name: 'YouTube' })).toBeVisible();
});
```

(If the seed landing has no YouTube-views tier, this asserts the fallback instead — see Step 4. Verify the seed first: `grep -i "youtube" prisma/seed.ts`.)

- [ ] **Step 2: Run it to verify it fails**

Run (from `frontend/`): `npx playwright test home-calculator -g "pre-adds"`
Expected: FAIL — no item is auto-added today.

- [ ] **Step 3: Implement**

In `service-tiers.tsx`:

(a) Add a pure helper above the component:

```typescript
function findYoutubeViewsTier(tiers: LandingResponse['tiers']): LandingTierResponse | null {
  return (
    tiers.find(
      (t) =>
        t.service.platform.toUpperCase() === 'YOUTUBE' && t.service.type.toUpperCase() === 'VIEWS',
    ) ?? null
  );
}
```

(b) Replace the body of the `onHeroLink` handler (the one inside the mount `useEffect`) so it prefers the YouTube-views auto-add:

```typescript
const applyHeroLink = (detail: string) => {
  const ytTier = findYoutubeViewsTier(tiers);
  if (ytTier) {
    setPlatform('YOUTUBE');
    setPage(1);
    const existing = cartRef.current.items.find((i) => i.tierId === ytTier.id);
    if (existing) {
      cartRef.current.setLink(existing.id, detail);
    } else {
      cartRef.current.addItem(ytTier);
      setTimeout(() => {
        const added = cartRef.current.items.find((i) => i.tierId === ytTier.id);
        if (added) cartRef.current.setLink(added.id, detail);
      }, 0);
    }
  } else {
    // Fallback: fill the first empty-link item, else store as pending.
    const emptyItem = cartRef.current.items.find((i) => !i.link.trim());
    if (emptyItem) cartRef.current.setLink(emptyItem.id, detail);
    else pendingHeroLink.current = detail;
  }
  if (panelRef.current) {
    panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

const stored = (() => {
  try {
    return sessionStorage.getItem(HERO_LINK_STORAGE_KEY);
  } catch {
    return null;
  }
})();
if (stored) applyHeroLink(stored);

const onHeroLink = (e: Event) => {
  const detail = (e as CustomEvent<string>).detail;
  if (typeof detail === 'string') applyHeroLink(detail);
};
window.addEventListener('youboost:hero-link', onHeroLink);
return () => window.removeEventListener('youboost:hero-link', onHeroLink);
```

**Important:** verify the cart item field name for the source tier id. Open `frontend/src/lib/landings/use-cart.ts` and confirm each item exposes `tierId` (or the equivalent). If it is named differently (e.g. `tier.id` stored as `id` is the cart-item id, not the tier id), use the correct field. The `CartItem` shape is the source of truth — match it exactly. Also confirm `LandingTierResponse` is already imported (it is, line 17).

(c) Remove the now-duplicated `stored`/`pendingHeroLink` mount logic that this replaces (the old `try { const stored = … }` block and old `onHeroLink`), keeping a single effect. Leave `handleAddToOrder`'s pending-link handling intact for the manual "Pay" path.

- [ ] **Step 4: Run the test**

Run (from `frontend/`): `npx playwright test home-calculator`
Expected: PASS. If the seed has no YouTube-views tier, change the new test to assert the fallback (the link is applied to a manually added item) and add a seed YouTube-views tier in a separate, explicit step — do NOT silently skip.

- [ ] **Step 5: Typecheck + commit**

Run (from `frontend/`): `npx tsc --noEmit`

```bash
git add frontend/src/components/marketing/service-tiers.tsx frontend/e2e/home-calculator.spec.ts
git commit -m "feat(frontend): hero Go pre-adds YouTube-views service with link"
```

---

# Integration & Verification (run after all tracks land)

- [ ] **Backend:** `npx tsc --noEmit && npx jest src/modules/auth src/shared/config` → all green.
- [ ] **Frontend typecheck:** from `frontend/` `npx tsc --noEmit` → green.
- [ ] **E2E:** from `frontend/` run dev stack (backend `PORT=3100 npm run start:dev`, frontend on 3101 under Node 22) then `npx playwright test auth-google home-calculator landing-cart` → green. Keep total password logins ≤10.
- [ ] **Runtime smoke (Google):** with real `.env` creds set, hit `/api/auth/google` in a browser, complete consent, confirm redirect lands on `/dashboard` authenticated. (Requires the redirect URI registered in Google Cloud Console.)
- [ ] **Migration on prod:** the `youboost-migrate` container runs `prisma migrate deploy` on deploy — confirm the `add_google_auth` migration applies cleanly.
- [ ] **Deploy:** push, then `docker compose build --no-cache backend frontend && docker compose up -d`.

---

## Self-review notes (addressed)

- **Spec coverage:** schema (A1), config (A4), Google service + state (A5), loginWithGoogle 3 branches + null guard (A3), routes incl. error redirect (A6), wiring (A7), frontend button/callback/setSession/error (B1–B4), e2e (B5), hero Go auto-add + fallback (C1). All spec sections mapped.
- **Type consistency:** `loginWithGoogle(profile)`, `GoogleProfile { googleId,email,emailVerified }`, `setSession({accessToken,refreshToken})`, `findYoutubeViewsTier`, fragment `accessToken/refreshToken` — names identical across backend, frontend, and tests.
- **Known verify-points flagged inline:** cart item tier-id field (C1), `Button asChild` support (B2), `useSearchParams` Suspense (B4), seed YouTube-views tier existence (C1).
