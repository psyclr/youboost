import { createAdminDepositsService } from '../admin-deposits.service';
import {
  createFakeDepositRepo,
  createFakeWalletRepo,
  createFakeLedgerRepo,
  createFakePrisma,
  silentLogger,
} from './fakes';

describe('Admin Deposits Service', () => {
  describe('listAllDeposits', () => {
    it('should return paginated list with Decimal fields mapped to numbers and userId included', async () => {
      const depositRepo = createFakeDepositRepo([
        {
          id: 'dep-1',
          userId: 'user-1',
          amount: 100,
          cryptoAmount: 95.5,
          cryptoCurrency: 'USDT',
          paymentAddress: 'TXyz123abc',
          status: 'PENDING',
          expiresAt: new Date('2024-01-02'),
        },
      ]);
      const walletRepo = createFakeWalletRepo();
      const ledgerRepo = createFakeLedgerRepo();
      const prisma = createFakePrisma();

      const service = createAdminDepositsService({
        prisma: prisma.client,
        depositRepo,
        walletRepo,
        ledgerRepo,
        logger: silentLogger,
      });

      const result = await service.listAllDeposits({ page: 1, limit: 20 });

      expect(result.deposits).toHaveLength(1);
      const first = result.deposits[0]!;
      expect(first.id).toBe('dep-1');
      expect(first.userId).toBe('user-1');
      expect(first.amount).toBe(100);
      expect(typeof first.amount).toBe('number');
      expect(first.cryptoAmount).toBe(95.5);
      expect(typeof first.cryptoAmount).toBe('number');
      expect(first.cryptoCurrency).toBe('USDT');
      expect(first.status).toBe('PENDING');
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('should pass status filter to repository', async () => {
      const depositRepo = createFakeDepositRepo([
        { id: 'dep-1', status: 'CONFIRMED' },
        { id: 'dep-2', status: 'PENDING' },
      ]);
      const walletRepo = createFakeWalletRepo();
      const ledgerRepo = createFakeLedgerRepo();
      const prisma = createFakePrisma();

      const service = createAdminDepositsService({
        prisma: prisma.client,
        depositRepo,
        walletRepo,
        ledgerRepo,
        logger: silentLogger,
      });

      const result = await service.listAllDeposits({ page: 1, limit: 20, status: 'CONFIRMED' });

      expect(result.deposits).toHaveLength(1);
      expect(result.deposits[0]?.id).toBe('dep-1');
    });
  });

  describe('adminConfirmDeposit', () => {
    it('should confirm pending deposit, credit wallet, and create ledger entry', async () => {
      const depositRepo = createFakeDepositRepo([
        {
          id: 'dep-1',
          userId: 'user-1',
          amount: 100,
          cryptoAmount: 95.5,
          cryptoCurrency: 'USDT',
          paymentAddress: 'TXyz',
          status: 'PENDING',
        },
      ]);
      const walletRepo = createFakeWalletRepo({ userId: 'user-1', balance: 50, holdAmount: 0 });
      const ledgerRepo = createFakeLedgerRepo();
      const prisma = createFakePrisma();

      const service = createAdminDepositsService({
        prisma: prisma.client,
        depositRepo,
        walletRepo,
        ledgerRepo,
        logger: silentLogger,
      });

      const result = await service.adminConfirmDeposit('dep-1');

      expect(result.status).toBe('CONFIRMED');
      expect(result.amount).toBe(100);

      // Ledger entry should have been created with correct fields
      expect(ledgerRepo.createCalls).toHaveLength(1);
      expect(ledgerRepo.createCalls[0]?.data).toMatchObject({
        userId: 'user-1',
        type: 'DEPOSIT',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        referenceType: 'deposit',
        referenceId: 'dep-1',
        description: 'Admin-confirmed deposit $100',
      });
    });

    it('should throw NotFoundError if deposit not found', async () => {
      const service = createAdminDepositsService({
        prisma: createFakePrisma().client,
        depositRepo: createFakeDepositRepo(),
        walletRepo: createFakeWalletRepo(),
        ledgerRepo: createFakeLedgerRepo(),
        logger: silentLogger,
      });

      await expect(service.adminConfirmDeposit('nonexistent')).rejects.toThrow('Deposit not found');
    });

    it('should throw ValidationError if deposit is not PENDING', async () => {
      const depositRepo = createFakeDepositRepo([{ id: 'dep-1', status: 'CONFIRMED', amount: 50 }]);
      const service = createAdminDepositsService({
        prisma: createFakePrisma().client,
        depositRepo,
        walletRepo: createFakeWalletRepo(),
        ledgerRepo: createFakeLedgerRepo(),
        logger: silentLogger,
      });

      await expect(service.adminConfirmDeposit('dep-1')).rejects.toThrow('Deposit is not pending');
    });
  });

  describe('adminExpireDeposit', () => {
    it('should expire pending deposit', async () => {
      const depositRepo = createFakeDepositRepo([
        { id: 'dep-1', userId: 'user-1', amount: 100, status: 'PENDING' },
      ]);
      const service = createAdminDepositsService({
        prisma: createFakePrisma().client,
        depositRepo,
        walletRepo: createFakeWalletRepo(),
        ledgerRepo: createFakeLedgerRepo(),
        logger: silentLogger,
      });

      const result = await service.adminExpireDeposit('dep-1');

      expect(result.status).toBe('EXPIRED');
    });

    it('should throw NotFoundError if deposit not found', async () => {
      const service = createAdminDepositsService({
        prisma: createFakePrisma().client,
        depositRepo: createFakeDepositRepo(),
        walletRepo: createFakeWalletRepo(),
        ledgerRepo: createFakeLedgerRepo(),
        logger: silentLogger,
      });

      await expect(service.adminExpireDeposit('nonexistent')).rejects.toThrow('Deposit not found');
    });

    it('should throw ValidationError if deposit is not PENDING', async () => {
      const depositRepo = createFakeDepositRepo([{ id: 'dep-1', status: 'EXPIRED' }]);
      const service = createAdminDepositsService({
        prisma: createFakePrisma().client,
        depositRepo,
        walletRepo: createFakeWalletRepo(),
        ledgerRepo: createFakeLedgerRepo(),
        logger: silentLogger,
      });

      await expect(service.adminExpireDeposit('dep-1')).rejects.toThrow('Deposit is not pending');
    });
  });
});
