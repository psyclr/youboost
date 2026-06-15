import type { Prisma, PrismaClient } from '../../../generated/prisma';
import { createAuthService } from '../auth.service';
import { createAuthAutoUserService } from '../auth-auto-user.service';
import { buildOutboxHandlers, type OutboxHandlerDeps } from '../../../composition/outbox-handlers';
import { createHandlerRegistry, type OutboxEvent, type OutboxPort } from '../../../shared/outbox';
import {
  createFakeUserRepository,
  createFakeTokenRepository,
  createFakeEmailTokenRepository,
  silentLogger,
} from './fakes';
import { createFakeEmailProvider, type FakeEmailProvider } from '../../notifications/__tests__/fakes';

jest.mock('../utils/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed'),
  comparePassword: jest.fn().mockResolvedValue(true),
}));

// hashToken as identity so the raw token carried in the emailed setup link
// resolves against the in-memory token store on the set-password lookup.
jest.mock('../utils/tokens', () => ({
  generateAccessToken: jest.fn().mockReturnValue('access-token'),
  generateRefreshToken: jest.fn().mockReturnValue('refresh-token'),
  hashToken: jest.fn((token: string) => token),
  getRefreshExpiresAt: jest.fn().mockReturnValue(new Date('2030-01-01')),
}));

function createFakePrisma(): PrismaClient {
  const tx = {} as Prisma.TransactionClient;
  return {
    $transaction: async <T>(cb: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => cb(tx),
  } as unknown as PrismaClient;
}

// Build the REAL production handler registry. Only emailProvider is exercised
// here; the other handlers are constructed but never dispatched, so stub deps
// are sufficient. Using buildOutboxHandlers (not a hand-picked handler) is the
// point: it proves user.auto_registered is actually wired in production.
function buildRealRegistry(emailProvider: FakeEmailProvider): ReturnType<typeof createHandlerRegistry> {
  const deps = {
    webhookDispatcher: {},
    notificationsService: {},
    couponsService: {},
    referralsService: {},
    emailProvider,
  } as unknown as OutboxHandlerDeps;
  return createHandlerRegistry(buildOutboxHandlers(deps));
}

describe('guest auto-registration email (production wiring)', () => {
  it('wires a subscriber for user.auto_registered so the event is not silently dropped', () => {
    const registry = buildRealRegistry(createFakeEmailProvider());
    expect(registry.handlersFor('user.auto_registered')).toContain('auto-user-setup-email');
  });

  it('a guest checkout emails a usable set-password link that actually claims the account', async () => {
    const emailProvider = createFakeEmailProvider();
    const registry = buildRealRegistry(emailProvider);

    // Outbox that dispatches synchronously through the real registry — the same
    // path production takes (emit → dispatcher → handler), minus the DB queue.
    const dispatched: OutboxEvent[] = [];
    const outbox: OutboxPort = {
      async emit(event): Promise<void> {
        dispatched.push(event);
        await registry.dispatch(event, 'evt-test');
      },
    };

    const prisma = createFakePrisma();
    const userRepo = createFakeUserRepository();
    const emailTokenRepo = createFakeEmailTokenRepository();
    const autoUser = createAuthAutoUserService({
      prisma,
      userRepo,
      emailTokenRepo,
      outbox,
      appUrl: 'https://www.youboost.store',
      logger: silentLogger,
    });
    const service = createAuthService({
      prisma,
      userRepo,
      tokenStore: createFakeTokenRepository(),
      emailTokenRepo,
      outbox,
      autoUser,
      appUrl: 'https://www.youboost.store',
      logger: silentLogger,
    });

    // 1. Guest buys without registering → account provisioned in the background.
    const ticket = await service.createAutoUser('guest@gmail.com');

    // 2. The customer actually receives an email carrying the setup link.
    expect(dispatched.map((e) => e.type)).toContain('user.auto_registered');
    expect(emailProvider.sent).toHaveLength(1);
    const mail = emailProvider.sent[0];
    expect(mail?.to).toBe('guest@gmail.com');
    expect(mail?.subject).toBe('Complete your YouBoost account');
    expect(mail?.body).toContain(ticket.setupUrl);

    // 3. The token embedded in the EMAIL (not just the return value) is valid:
    //    extract it from the sent body and use it to set a password.
    const tokenFromEmail = /set-password\?token=([^"<&\s]+)/.exec(mail?.body ?? '')?.[1];
    expect(tokenFromEmail).toBeTruthy();

    const result = await service.setPasswordViaAutoUserToken(
      tokenFromEmail as string,
      'StrongPass123',
    );

    // 4. The account is claimed — the guest can now own it.
    expect(result.userId).toBe(ticket.userId);
    expect(userRepo.calls.finalizeAutoUser).toHaveLength(1);
  });
});
