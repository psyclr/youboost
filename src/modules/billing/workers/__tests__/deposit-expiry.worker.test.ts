import type { DepositRecord } from '../../deposit.types';
import type { DepositRepository } from '../../deposit.repository';
import type { DepositLifecycleService } from '../../deposit-lifecycle.service';

// Intercept shared/queue so we don't touch real redis/bullmq wiring in tests.
// Worker processor is captured via the startNamedWorker mock so tests can drive it.
let capturedProcessor: ((job: unknown) => Promise<void>) | null = null;

jest.mock('../../../../shared/queue', () => ({
  getNamedQueue: jest.fn().mockReturnValue({
    add: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }),
  startNamedWorker: jest
    .fn()
    .mockImplementation(
      async (_name: string, processor: (job: unknown) => Promise<void>): Promise<void> => {
        capturedProcessor = processor;
      },
    ),
  stopNamedWorker: jest.fn().mockResolvedValue(undefined),
}));

import { createDepositExpiryWorker } from '../deposit-expiry.worker';
import { silentLogger } from '../../__tests__/fakes';

function makeDeposit(overrides: Partial<DepositRecord> = {}): DepositRecord {
  return {
    id: 'dep-1',
    userId: 'user-1',
    amount: { toNumber: () => 50 } as DepositRecord['amount'],
    cryptoAmount: { toNumber: () => 50 } as DepositRecord['cryptoAmount'],
    cryptoCurrency: 'USDT',
    paymentAddress: 'addr-1',
    status: 'PENDING',
    txHash: null,
    expiresAt: new Date('2025-01-01'),
    confirmedAt: null,
    ledgerEntryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDepositRepo(
  expired: DepositRecord[],
): jest.Mocked<Pick<DepositRepository, 'findExpiredPendingDeposits'>> & DepositRepository {
  const repo = {
    createDeposit: jest.fn(),
    findDepositById: jest.fn(),
    findDepositsByUserId: jest.fn(),
    findAllDeposits: jest.fn(),
    findExpiredPendingDeposits: jest.fn().mockResolvedValue(expired),
    updateDepositStripeSession: jest.fn(),
    updateDepositCryptomusOrder: jest.fn(),
    findDepositByCryptomusOrderId: jest.fn(),
    updateDepositStatus: jest.fn(),
  } as unknown as jest.Mocked<DepositRepository>;
  return repo;
}

function makeLifecycle(): jest.Mocked<DepositLifecycleService> {
  return {
    prepareDepositCheckout: jest.fn(),
    confirmDepositTransaction: jest.fn(),
    failDepositTransaction: jest.fn().mockResolvedValue(undefined),
  };
}

async function runProcessor(
  depositRepo: DepositRepository,
  lifecycle: DepositLifecycleService,
): Promise<void> {
  const worker = createDepositExpiryWorker({ depositRepo, lifecycle, logger: silentLogger });
  await worker.start();
  if (!capturedProcessor) throw new Error('processor not captured');
  await capturedProcessor({});
  await worker.stop();
}

describe('Deposit Expiry Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedProcessor = null;
  });

  it('should do nothing when no expired deposits', async () => {
    const depositRepo = makeDepositRepo([]);
    const lifecycle = makeLifecycle();

    await runProcessor(depositRepo, lifecycle);

    expect(depositRepo.findExpiredPendingDeposits).toHaveBeenCalled();
    expect(lifecycle.failDepositTransaction).not.toHaveBeenCalled();
  });

  it('should fail each expired deposit via lifecycle.failDepositTransaction', async () => {
    const dep1 = makeDeposit({ id: 'dep-1', userId: 'user-1' });
    const dep2 = makeDeposit({ id: 'dep-2', userId: 'user-2' });
    const dep3 = makeDeposit({ id: 'dep-3', userId: 'user-3' });
    const depositRepo = makeDepositRepo([dep1, dep2, dep3]);
    const lifecycle = makeLifecycle();

    await runProcessor(depositRepo, lifecycle);

    expect(lifecycle.failDepositTransaction).toHaveBeenCalledTimes(3);
    expect(lifecycle.failDepositTransaction).toHaveBeenCalledWith('dep-1', 'expiry', 'expired');
    expect(lifecycle.failDepositTransaction).toHaveBeenCalledWith('dep-2', 'expiry', 'expired');
    expect(lifecycle.failDepositTransaction).toHaveBeenCalledWith('dep-3', 'expiry', 'expired');
  });

  it('should continue processing others when one deposit fails to expire', async () => {
    const dep1 = makeDeposit({ id: 'dep-1' });
    const dep2 = makeDeposit({ id: 'dep-2' });
    const dep3 = makeDeposit({ id: 'dep-3' });
    const depositRepo = makeDepositRepo([dep1, dep2, dep3]);
    const lifecycle = makeLifecycle();
    lifecycle.failDepositTransaction
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce(undefined);

    await runProcessor(depositRepo, lifecycle);

    expect(lifecycle.failDepositTransaction).toHaveBeenCalledTimes(3);
    expect(lifecycle.failDepositTransaction).toHaveBeenCalledWith('dep-1', 'expiry', 'expired');
    expect(lifecycle.failDepositTransaction).toHaveBeenCalledWith('dep-2', 'expiry', 'expired');
    expect(lifecycle.failDepositTransaction).toHaveBeenCalledWith('dep-3', 'expiry', 'expired');
  });
});
