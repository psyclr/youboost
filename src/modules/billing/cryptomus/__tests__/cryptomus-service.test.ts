import { signRequestBody } from '../cryptomus.crypto';

jest.mock('../../../../shared/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    cryptomus: {
      merchantId: 'merchant-1',
      paymentKey: 'payment-key-xyz',
      callbackUrl: 'https://example.com',
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
const mockFindDepositByCryptomusOrderId = jest.fn();
const mockUpdateDepositStatus = jest.fn();
jest.mock('../../deposit.repository', () => ({
  findDepositById: (...args: unknown[]): unknown => mockFindDepositById(...args),
  findDepositByCryptomusOrderId: (...args: unknown[]): unknown =>
    mockFindDepositByCryptomusOrderId(...args),
  updateDepositStatus: (...args: unknown[]): unknown => mockUpdateDepositStatus(...args),
  createDeposit: jest.fn(),
  updateDepositCryptomusOrder: jest.fn(),
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

// Import AFTER mocks are set up
import { handleWebhookEvent } from '../cryptomus.service';

function buildWebhook(bodyObj: Record<string, unknown>): string {
  const unsignedJson = JSON.stringify(bodyObj);
  const sign = signRequestBody(unsignedJson, 'payment-key-xyz');
  return JSON.stringify({ ...bodyObj, sign });
}

describe('Cryptomus service - deposit confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactionCallCount = 0;
  });

  it('wraps deposit confirmation in a transaction on paid status', async () => {
    mockFindDepositByCryptomusOrderId.mockResolvedValue({
      id: 'dep-1',
      userId: 'user-1',
      status: 'PENDING',
    });
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

    const webhookBody = buildWebhook({
      order_id: 'dep-1',
      status: 'paid',
      amount: '25.00',
    });

    await handleWebhookEvent(webhookBody);

    expect(transactionCallCount).toBe(1);
    expect(mockUpdateBalance).toHaveBeenCalledWith(expect.objectContaining({ newBalance: 25 }));
    expect(mockUpdateDepositStatus).toHaveBeenCalledWith(
      'dep-1',
      expect.objectContaining({ status: 'CONFIRMED' }),
      expect.anything(),
    );
  });

  it('is idempotent: already-CONFIRMED deposit does not re-credit', async () => {
    mockFindDepositByCryptomusOrderId.mockResolvedValue({
      id: 'dep-1',
      userId: 'user-1',
      status: 'CONFIRMED',
    });
    mockFindDepositById.mockResolvedValue({
      id: 'dep-1',
      userId: 'user-1',
      amount: 25,
      status: 'CONFIRMED',
    });

    const webhookBody = buildWebhook({
      order_id: 'dep-1',
      status: 'paid',
      amount: '25.00',
    });

    await handleWebhookEvent(webhookBody);

    expect(transactionCallCount).toBe(1);
    expect(mockUpdateBalance).not.toHaveBeenCalled();
    expect(mockCreateLedgerEntry).not.toHaveBeenCalled();
    expect(mockUpdateDepositStatus).not.toHaveBeenCalled();
  });

  it('confirms on paid_over status (overpayment)', async () => {
    mockFindDepositByCryptomusOrderId.mockResolvedValue({
      id: 'dep-1',
      userId: 'user-1',
      status: 'PENDING',
    });
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

    const webhookBody = buildWebhook({
      order_id: 'dep-1',
      status: 'paid_over',
      amount: '30.00',
    });

    await handleWebhookEvent(webhookBody);

    expect(mockUpdateDepositStatus).toHaveBeenCalledWith(
      'dep-1',
      expect.objectContaining({ status: 'CONFIRMED' }),
      expect.anything(),
    );
  });

  it('marks deposit FAILED on fail status inside transaction', async () => {
    mockFindDepositByCryptomusOrderId.mockResolvedValue({
      id: 'dep-1',
      userId: 'user-1',
      status: 'PENDING',
    });
    mockFindDepositById.mockResolvedValue({
      id: 'dep-1',
      userId: 'user-1',
      status: 'PENDING',
    });

    const webhookBody = buildWebhook({
      order_id: 'dep-1',
      status: 'fail',
    });

    await handleWebhookEvent(webhookBody);

    expect(transactionCallCount).toBe(1);
    expect(mockUpdateDepositStatus).toHaveBeenCalledWith(
      'dep-1',
      expect.objectContaining({ status: 'FAILED' }),
      expect.anything(),
    );
  });

  it('throws on invalid webhook signature', async () => {
    const webhookBody = JSON.stringify({
      order_id: 'dep-1',
      status: 'paid',
      sign: 'invalid-signature',
    });

    await expect(handleWebhookEvent(webhookBody)).rejects.toThrow(
      /Invalid Cryptomus webhook signature/,
    );
    expect(mockFindDepositByCryptomusOrderId).not.toHaveBeenCalled();
  });

  it('ignores webhook with unknown order_id', async () => {
    mockFindDepositByCryptomusOrderId.mockResolvedValue(null);

    const webhookBody = buildWebhook({
      order_id: 'unknown',
      status: 'paid',
    });

    await handleWebhookEvent(webhookBody);

    expect(mockUpdateBalance).not.toHaveBeenCalled();
  });
});
