import type { DepositRecord } from '../../deposit.types';

const mockFindExpiredPendingDeposits = jest.fn();
const mockUpdateDepositStatus = jest.fn();

jest.mock('../../../../shared/utils/logger', () => ({
  createServiceLogger: jest
    .fn()
    .mockReturnValue({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('../../../../shared/redis/redis', () => ({
  getRedis: jest.fn().mockReturnValue({ duplicate: jest.fn().mockReturnValue({}) }),
}));
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Worker: jest.fn().mockImplementation((_name: string, processor: Function) => {
    (Worker as unknown as { __processor: Function }).__processor = processor;
    return {
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
  }),
}));
jest.mock('../../deposit.repository', () => ({
  findExpiredPendingDeposits: (...args: unknown[]): unknown =>
    mockFindExpiredPendingDeposits(...args),
  updateDepositStatus: (...args: unknown[]): unknown => mockUpdateDepositStatus(...args),
}));

const { Worker } = jest.requireMock<typeof import('bullmq')>('bullmq');

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

/**
 * The worker's processExpiredDeposits is not exported directly.
 * We capture the processor callback passed to the BullMQ Worker constructor
 * via our mock, then invoke it to exercise the logic.
 */
async function runProcessor(): Promise<void> {
  const { startDepositExpiryWorker, stopDepositExpiryWorker } =
    await import('../deposit-expiry.worker');
  await startDepositExpiryWorker();
  const processor = (Worker as unknown as { __processor: Function }).__processor;
  await processor({});
  await stopDepositExpiryWorker();
}

describe('Deposit Expiry Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockFindExpiredPendingDeposits.mockResolvedValue([]);
    mockUpdateDepositStatus.mockResolvedValue({});
  });

  it('should do nothing when no expired deposits', async () => {
    mockFindExpiredPendingDeposits.mockResolvedValue([]);
    await runProcessor();
    expect(mockFindExpiredPendingDeposits).toHaveBeenCalled();
    expect(mockUpdateDepositStatus).not.toHaveBeenCalled();
  });

  it('should update each expired deposit to EXPIRED status', async () => {
    const dep1 = makeDeposit({ id: 'dep-1', userId: 'user-1' });
    const dep2 = makeDeposit({ id: 'dep-2', userId: 'user-2' });
    const dep3 = makeDeposit({ id: 'dep-3', userId: 'user-3' });
    mockFindExpiredPendingDeposits.mockResolvedValue([dep1, dep2, dep3]);

    await runProcessor();

    expect(mockUpdateDepositStatus).toHaveBeenCalledTimes(3);
    expect(mockUpdateDepositStatus).toHaveBeenCalledWith('dep-1', { status: 'EXPIRED' });
    expect(mockUpdateDepositStatus).toHaveBeenCalledWith('dep-2', { status: 'EXPIRED' });
    expect(mockUpdateDepositStatus).toHaveBeenCalledWith('dep-3', { status: 'EXPIRED' });
  });

  it('should continue processing others when one deposit fails to expire', async () => {
    const dep1 = makeDeposit({ id: 'dep-1' });
    const dep2 = makeDeposit({ id: 'dep-2' });
    const dep3 = makeDeposit({ id: 'dep-3' });
    mockFindExpiredPendingDeposits.mockResolvedValue([dep1, dep2, dep3]);
    mockUpdateDepositStatus
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({});

    await runProcessor();

    expect(mockUpdateDepositStatus).toHaveBeenCalledTimes(3);
    expect(mockUpdateDepositStatus).toHaveBeenCalledWith('dep-1', { status: 'EXPIRED' });
    expect(mockUpdateDepositStatus).toHaveBeenCalledWith('dep-2', { status: 'EXPIRED' });
    expect(mockUpdateDepositStatus).toHaveBeenCalledWith('dep-3', { status: 'EXPIRED' });
  });
});
