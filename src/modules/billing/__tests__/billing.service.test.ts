import { createBillingService } from '../billing.service';
import {
  createFakeDepositRepository,
  createFakeLedgerRepository,
  createFakeWalletRepository,
  silentLogger,
} from './fakes';
function makeService(
  seed: { balance?: number; holdAmount?: number } = { balance: 100, holdAmount: 10 },
) {
  const walletRepo = createFakeWalletRepository({
    userId: 'user-1',
    walletId: 'wallet-1',
    balance: seed.balance ?? 100,
    holdAmount: seed.holdAmount ?? 10,
  });
  const ledgerRepo = createFakeLedgerRepository();
  const depositRepo = createFakeDepositRepository();
  const service = createBillingService({
    walletRepo,
    ledgerRepo,
    depositRepo,
    logger: silentLogger,
  });
  return { service, walletRepo, ledgerRepo, depositRepo };
}

describe('Billing Service', () => {
  describe('getBalance', () => {
    it('should return balance with available computed', async () => {
      const { service } = makeService({ balance: 100, holdAmount: 10 });

      const result = await service.getBalance('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.balance).toBe(100);
      expect(result.frozen).toBe(10);
      expect(result.available).toBe(90);
      expect(result.currency).toBe('USD');
    });

    it('should create wallet for new user', async () => {
      const { service } = makeService({ balance: 0, holdAmount: 0 });
      // New user not seeded — wallet auto-created by fake on first call.
      const result = await service.getBalance('new-user');

      expect(result.balance).toBe(0);
      expect(result.available).toBe(0);
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const { service, ledgerRepo } = makeService();
      await ledgerRepo.createLedgerEntry({
        userId: 'user-1',
        walletId: 'wallet-1',
        type: 'DEPOSIT',
        amount: 50,
        balanceBefore: 0,
        balanceAfter: 50,
        description: 'Test deposit',
      });

      const result = await service.getTransactions('user-1', { page: 1, limit: 20 });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.amount).toBe(50);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should pass type filter', async () => {
      const walletRepo = createFakeWalletRepository({ userId: 'u', balance: 0 });
      const depositRepo = createFakeDepositRepository();
      const ledgerRepo = createFakeLedgerRepository();
      const findSpy = jest.spyOn(ledgerRepo, 'findLedgerEntries');
      const service = createBillingService({
        walletRepo,
        ledgerRepo,
        depositRepo,
        logger: silentLogger,
      });

      await service.getTransactions('user-1', { page: 1, limit: 20, type: 'HOLD' });

      expect(findSpy).toHaveBeenCalledWith('user-1', { type: 'HOLD', page: 1, limit: 20 });
    });

    it('should calculate correct totalPages', async () => {
      const { service, ledgerRepo } = makeService();
      // Seed 45 entries
      for (let i = 0; i < 45; i += 1) {
        await ledgerRepo.createLedgerEntry({
          userId: 'user-1',
          walletId: 'wallet-1',
          type: 'HOLD',
          amount: 1,
          balanceBefore: 0,
          balanceAfter: 0,
        });
      }
      const result = await service.getTransactions('user-1', { page: 1, limit: 20 });
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should return empty transactions array when none found', async () => {
      const { service } = makeService();
      const result = await service.getTransactions('user-1', { page: 1, limit: 20 });
      expect(result.transactions).toHaveLength(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('getTransactionById', () => {
    it('should return detailed transaction', async () => {
      const { service, ledgerRepo } = makeService();
      const entry = await ledgerRepo.createLedgerEntry({
        userId: 'user-1',
        walletId: 'wallet-1',
        type: 'DEPOSIT',
        amount: 50,
        balanceBefore: 0,
        balanceAfter: 50,
        description: null,
      });

      const result = await service.getTransactionById('user-1', entry.id);

      expect(result.id).toBe(entry.id);
      expect(result.amount).toBe(50);
      expect(result.balanceBefore).toBe(0);
      expect(result.balanceAfter).toBe(50);
    });

    it('should throw NotFoundError if not found', async () => {
      const { service } = makeService();
      await expect(service.getTransactionById('user-1', 'bad-id')).rejects.toThrow(
        'Transaction not found',
      );
    });

    it('should pass userId for authorization scoping', async () => {
      const { service, ledgerRepo } = makeService();
      const entry = await ledgerRepo.createLedgerEntry({
        userId: 'user-2', // different user
        walletId: 'wallet-2',
        type: 'DEPOSIT',
        amount: 10,
        balanceBefore: 0,
        balanceAfter: 10,
      });
      // Authorization scoping: user-1 cannot see user-2's ledger entry.
      await expect(service.getTransactionById('user-1', entry.id)).rejects.toThrow(
        'Transaction not found',
      );
    });
  });
});
