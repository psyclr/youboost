import type { Logger } from 'pino';
import { submitWithFailover, type FailoverDeps } from '../submit-with-failover';
import type { PanelCandidate } from '../../providers/service-provider-mapping.repository';
import { createFakeProviderClient } from './fakes';

const silentLogger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  child: (): Logger => silentLogger,
  level: 'silent',
  silent: jest.fn(),
} as unknown as Logger;

const args = { orderId: 'o1', userId: 'u1', serviceId: 's1', link: 'l1', quantity: 100 };

function makeDeps(opts: {
  candidates: PanelCandidate[];
  failProviderIds?: Set<string>;
}): FailoverDeps & { attempts: { providerId: string; outcome: string }[] } {
  const attempts: { providerId: string; outcome: string }[] = [];
  const fail = opts.failProviderIds ?? new Set<string>();
  return {
    attempts,
    providerSelector: {
      async selectProviderById(providerId: string) {
        const client = createFakeProviderClient({
          submitOrder: jest.fn(async () => {
            if (fail.has(providerId)) throw new Error('not enough funds');
            return { externalOrderId: `ext-${providerId}`, status: 'processing' };
          }),
        });
        return { providerId, client };
      },
      async selectProvider() {
        throw new Error('not used');
      },
    },
    mappingRepo: {
      async listActiveByServiceId() {
        return opts.candidates;
      },
    },
    attemptRepo: {
      async record(input) {
        attempts.push({ providerId: input.providerId, outcome: input.outcome });
      },
    },
    logger: silentLogger,
  };
}

const cand = (providerId: string, priority: number): PanelCandidate => ({
  providerId,
  externalServiceId: `ext-${providerId}`,
  priority,
  providerCost: 0,
});

describe('submitWithFailover', () => {
  it('routes to the second panel when the first fails; records both attempts', async () => {
    const deps = makeDeps({
      candidates: [cand('p1', 0), cand('p2', 1)],
      failProviderIds: new Set(['p1']),
    });
    const res = await submitWithFailover(deps, args);
    expect(res).toEqual({ ok: true, providerId: 'p2', externalOrderId: 'ext-p2' });
    expect(deps.attempts).toEqual([
      { providerId: 'p1', outcome: 'FAILED' },
      { providerId: 'p2', outcome: 'SUCCESS' },
    ]);
  });

  it('succeeds on the first panel without trying the rest', async () => {
    const deps = makeDeps({ candidates: [cand('p1', 0), cand('p2', 1)] });
    const res = await submitWithFailover(deps, args);
    expect(res).toEqual({ ok: true, providerId: 'p1', externalOrderId: 'ext-p1' });
    expect(deps.attempts).toEqual([{ providerId: 'p1', outcome: 'SUCCESS' }]);
  });

  it('returns ok:false with attempt count when every panel fails', async () => {
    const deps = makeDeps({
      candidates: [cand('p1', 0), cand('p2', 1)],
      failProviderIds: new Set(['p1', 'p2']),
    });
    const res = await submitWithFailover(deps, args);
    expect(res).toEqual({ ok: false, attempts: 2 });
    expect(deps.attempts).toEqual([
      { providerId: 'p1', outcome: 'FAILED' },
      { providerId: 'p2', outcome: 'FAILED' },
    ]);
  });

  it('returns ok:false attempts:0 when the service has no active panels', async () => {
    const deps = makeDeps({ candidates: [] });
    const res = await submitWithFailover(deps, args);
    expect(res).toEqual({ ok: false, attempts: 0 });
    expect(deps.attempts).toEqual([]);
  });
});
