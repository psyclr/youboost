import Stripe from 'stripe';
import { handleWebhookEvent } from '../stripe.service';

// Mock dependencies BEFORE importing stripe.service
jest.mock('../../../../shared/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    stripe: {
      secretKey: 'sk_test_fake',
      webhookSecret: 'whsec_fake',
    },
    app: { url: 'http://localhost:3000' },
  }),
}));

jest.mock('../../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockFindDepositById = jest.fn();
const mockUpdateDepositStatus = jest.fn();
jest.mock('../../deposit.repository', () => ({
  findDepositById: (...args: unknown[]): unknown => mockFindDepositById(...args),
  updateDepositStatus: (...args: unknown[]): unknown => mockUpdateDepositStatus(...args),
  createDeposit: jest.fn(),
  updateDepositStripeSession: jest.fn(),
}));

const mockGetOrCreateWallet = jest.fn();
const mockUpdateBalance = jest.fn();
jest.mock('../../wallet.repository', () => ({
  getOrCreateWallet: (...args: unknown[]): unknown => mockGetOrCreateWallet(...args),
  updateBalance: (...args: unknown[]): unknown => mockUpdateBalance(...args),
}));

const mockCreateLedgerEntry = jest.fn();
jest.mock('../../ledger.repository', () => ({
  createLedgerEntry: (...args: unknown[]): unknown => mockCreateLedgerEntry(...args),
}));

let transactionCallCount = 0;
jest.mock('../../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    $transaction: async (fn: (tx: unknown) => unknown) => {
      transactionCallCount++;
      return fn({});
    },
  }),
}));

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn((payload: string) => JSON.parse(payload)),
    },
  })),
);

describe('Stripe service - deposit confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactionCallCount = 0;
  });

  it('wraps deposit confirmation in a transaction', async () => {
    mockFindDepositById.mockResolvedValue({
      id: 'dep-1',
      userId: 'user-1',
      amount: 25,
      status: 'PENDING',
    });
    mockGetOrCreateWallet.mockResolvedValue({
      id: 'wallet-1',
      balance: 0,
      holdAmount: 0,
    });
    mockCreateLedgerEntry.mockResolvedValue({ id: 'ledger-1' });
    mockUpdateBalance.mockResolvedValue({});
    mockUpdateDepositStatus.mockResolvedValue({});

    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          metadata: { userId: 'user-1', depositId: 'dep-1' },
        } as unknown as Stripe.Checkout.Session,
      },
    };

    await handleWebhookEvent(JSON.stringify(event), 'sig_fake');

    expect(transactionCallCount).toBe(1);
    expect(mockUpdateBalance).toHaveBeenCalledWith(expect.objectContaining({ newBalance: 25 }));
    expect(mockUpdateDepositStatus).toHaveBeenCalledWith(
      'dep-1',
      expect.objectContaining({ status: 'CONFIRMED' }),
      expect.anything(),
    );
  });

  it('is idempotent: second call with already-processed deposit does nothing', async () => {
    mockFindDepositById.mockResolvedValue({
      id: 'dep-1',
      userId: 'user-1',
      amount: 25,
      status: 'CONFIRMED',
    });

    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          metadata: { userId: 'user-1', depositId: 'dep-1' },
        } as unknown as Stripe.Checkout.Session,
      },
    };

    await handleWebhookEvent(JSON.stringify(event), 'sig_fake');

    expect(transactionCallCount).toBe(1);
    expect(mockUpdateBalance).not.toHaveBeenCalled();
    expect(mockCreateLedgerEntry).not.toHaveBeenCalled();
    expect(mockUpdateDepositStatus).not.toHaveBeenCalled();
  });

  it('ignores webhook if deposit not found', async () => {
    mockFindDepositById.mockResolvedValue(null);

    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          metadata: { userId: 'user-1', depositId: 'dep-missing' },
        } as unknown as Stripe.Checkout.Session,
      },
    };

    await expect(handleWebhookEvent(JSON.stringify(event), 'sig_fake')).resolves.not.toThrow();
    expect(mockUpdateBalance).not.toHaveBeenCalled();
  });

  it('ignores webhook if metadata is missing', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: { id: 'cs_1', metadata: {} } as Stripe.Checkout.Session,
      },
    };

    await handleWebhookEvent(JSON.stringify(event), 'sig_fake');

    expect(transactionCallCount).toBe(0);
    expect(mockFindDepositById).not.toHaveBeenCalled();
  });
});
