import { createDepositLifecycleService } from '../deposit-lifecycle.service';
import {
  createFakePrisma,
  createFakeWalletRepository,
  createFakeLedgerRepository,
  createFakeDepositRepository,
  createFakeOutbox,
  silentLogger,
} from './fakes';

const billingConfig = { minDeposit: 5, maxDeposit: 10_000, depositExpiryMs: 3_600_000 };

describe('deposit-lifecycle.service', () => {
  describe('prepareDepositCheckout', () => {
    it('rejects amount below configured min', async () => {
      const prisma = createFakePrisma();
      const service = createDepositLifecycleService({
        prisma: prisma.client,
        walletRepo: createFakeWalletRepository(),
        ledgerRepo: createFakeLedgerRepository(),
        depositRepo: createFakeDepositRepository(),
        outbox: createFakeOutbox().port,
        billingConfig,
        logger: silentLogger,
      });
      await expect(service.prepareDepositCheckout('u1', 4)).rejects.toThrow(/Minimum deposit/);
    });

    it('rejects amount above configured max', async () => {
      const prisma = createFakePrisma();
      const service = createDepositLifecycleService({
        prisma: prisma.client,
        walletRepo: createFakeWalletRepository(),
        ledgerRepo: createFakeLedgerRepository(),
        depositRepo: createFakeDepositRepository(),
        outbox: createFakeOutbox().port,
        billingConfig,
        logger: silentLogger,
      });
      await expect(service.prepareDepositCheckout('u1', 10_001)).rejects.toThrow(/Maximum deposit/);
    });

    it('creates a deposit with configured expiry', async () => {
      const prisma = createFakePrisma();
      const walletRepo = createFakeWalletRepository();
      const depositRepo = createFakeDepositRepository();
      const service = createDepositLifecycleService({
        prisma: prisma.client,
        walletRepo,
        ledgerRepo: createFakeLedgerRepository(),
        depositRepo,
        outbox: createFakeOutbox().port,
        billingConfig,
        logger: silentLogger,
      });

      const result = await service.prepareDepositCheckout('u1', 25);

      expect(Number(result.amount)).toBe(25);
      expect(depositRepo.deposits).toHaveLength(1);
      expect(depositRepo.deposits[0]!.userId).toBe('u1');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('confirmDepositTransaction', () => {
    it('credits wallet and marks deposit CONFIRMED in a single tx', async () => {
      const prisma = createFakePrisma();
      const walletRepo = createFakeWalletRepository({ userId: 'u1', balance: 0, holdAmount: 0 });
      const ledgerRepo = createFakeLedgerRepository();
      const depositRepo = createFakeDepositRepository([
        { id: 'd1', userId: 'u1', amount: 25, status: 'PENDING' },
      ]);
      const outbox = createFakeOutbox();
      const service = createDepositLifecycleService({
        prisma: prisma.client,
        walletRepo,
        ledgerRepo,
        depositRepo,
        outbox: outbox.port,
        billingConfig,
        logger: silentLogger,
      });

      await service.confirmDepositTransaction('d1', 'u1', 'Stripe');

      expect(prisma.transactionCalls).toBe(1);
      const w = walletRepo._walletsByKey.get('u1:USD')!;
      expect(Number(w.balance)).toBe(25);
      const d = depositRepo.deposits[0]!;
      expect(d.status).toBe('CONFIRMED');
      expect(d.confirmedAt).toBeInstanceOf(Date);
      expect(ledgerRepo.entries).toHaveLength(1);
    });

    it('emits deposit.confirmed event inside the tx', async () => {
      const prisma = createFakePrisma();
      const walletRepo = createFakeWalletRepository({ userId: 'u1', balance: 0 });
      const depositRepo = createFakeDepositRepository([
        { id: 'd1', userId: 'u1', amount: 25, status: 'PENDING' },
      ]);
      const outbox = createFakeOutbox();
      const service = createDepositLifecycleService({
        prisma: prisma.client,
        walletRepo,
        ledgerRepo: createFakeLedgerRepository(),
        depositRepo,
        outbox: outbox.port,
        billingConfig,
        logger: silentLogger,
      });

      await service.confirmDepositTransaction('d1', 'u1', 'Stripe');

      expect(outbox.events).toHaveLength(1);
      expect(outbox.events[0]!.event).toMatchObject({
        type: 'deposit.confirmed',
        aggregateType: 'deposit',
        aggregateId: 'd1',
        userId: 'u1',
        payload: { depositId: 'd1', userId: 'u1', amount: 25, provider: 'Stripe' },
      });
      // The tx passed to outbox.emit must be the same sentinel used by prisma.$transaction.
      expect(outbox.events[0]!.tx).toBe(prisma.tx);
    });

    it('is idempotent on already-CONFIRMED deposit', async () => {
      const prisma = createFakePrisma();
      const walletRepo = createFakeWalletRepository({ userId: 'u1', balance: 0 });
      const ledgerRepo = createFakeLedgerRepository();
      const depositRepo = createFakeDepositRepository([
        { id: 'd1', userId: 'u1', amount: 25, status: 'CONFIRMED' },
      ]);
      const outbox = createFakeOutbox();
      const service = createDepositLifecycleService({
        prisma: prisma.client,
        walletRepo,
        ledgerRepo,
        depositRepo,
        outbox: outbox.port,
        billingConfig,
        logger: silentLogger,
      });

      await service.confirmDepositTransaction('d1', 'u1', 'Stripe');

      expect(ledgerRepo.entries).toHaveLength(0);
      expect(depositRepo.deposits[0]!.status).toBe('CONFIRMED');
      expect(outbox.events).toHaveLength(0);
    });

    it('ignores unknown deposit', async () => {
      const prisma = createFakePrisma();
      const outbox = createFakeOutbox();
      const ledgerRepo = createFakeLedgerRepository();
      const service = createDepositLifecycleService({
        prisma: prisma.client,
        walletRepo: createFakeWalletRepository(),
        ledgerRepo,
        depositRepo: createFakeDepositRepository(),
        outbox: outbox.port,
        billingConfig,
        logger: silentLogger,
      });

      await service.confirmDepositTransaction('missing', 'u1', 'Stripe');

      expect(ledgerRepo.entries).toHaveLength(0);
      expect(outbox.events).toHaveLength(0);
    });

    it('writes provider label into ledger description', async () => {
      const prisma = createFakePrisma();
      const ledgerRepo = createFakeLedgerRepository();
      const service = createDepositLifecycleService({
        prisma: prisma.client,
        walletRepo: createFakeWalletRepository({ userId: 'u1', balance: 0 }),
        ledgerRepo,
        depositRepo: createFakeDepositRepository([
          { id: 'd1', userId: 'u1', amount: 25, status: 'PENDING' },
        ]),
        outbox: createFakeOutbox().port,
        billingConfig,
        logger: silentLogger,
      });

      await service.confirmDepositTransaction('d1', 'u1', 'Cryptomus');

      expect(ledgerRepo.createCalls[0]!.data.description).toBe('Cryptomus deposit $25.00');
    });
  });

  describe('failDepositTransaction', () => {
    it('marks PENDING deposit as FAILED', async () => {
      const prisma = createFakePrisma();
      const depositRepo = createFakeDepositRepository([
        { id: 'd1', userId: 'u1', amount: 25, status: 'PENDING' },
      ]);
      const service = createDepositLifecycleService({
        prisma: prisma.client,
        walletRepo: createFakeWalletRepository(),
        ledgerRepo: createFakeLedgerRepository(),
        depositRepo,
        outbox: createFakeOutbox().port,
        billingConfig,
        logger: silentLogger,
      });

      await service.failDepositTransaction('d1', 'Cryptomus', 'fail');

      expect(depositRepo.deposits[0]!.status).toBe('FAILED');
    });

    it('emits deposit.failed event inside the tx', async () => {
      const prisma = createFakePrisma();
      const depositRepo = createFakeDepositRepository([
        { id: 'd1', userId: 'u1', amount: 25, status: 'PENDING' },
      ]);
      const outbox = createFakeOutbox();
      const service = createDepositLifecycleService({
        prisma: prisma.client,
        walletRepo: createFakeWalletRepository(),
        ledgerRepo: createFakeLedgerRepository(),
        depositRepo,
        outbox: outbox.port,
        billingConfig,
        logger: silentLogger,
      });

      await service.failDepositTransaction('d1', 'Cryptomus', 'wrong_amount');

      expect(outbox.events).toHaveLength(1);
      expect(outbox.events[0]!.event).toMatchObject({
        type: 'deposit.failed',
        aggregateType: 'deposit',
        aggregateId: 'd1',
        userId: 'u1',
        payload: { depositId: 'd1', userId: 'u1', reason: 'wrong_amount' },
      });
      expect(outbox.events[0]!.tx).toBe(prisma.tx);
    });

    it('is idempotent on non-PENDING deposit', async () => {
      const prisma = createFakePrisma();
      const depositRepo = createFakeDepositRepository([
        { id: 'd1', userId: 'u1', amount: 25, status: 'CONFIRMED' },
      ]);
      const outbox = createFakeOutbox();
      const service = createDepositLifecycleService({
        prisma: prisma.client,
        walletRepo: createFakeWalletRepository(),
        ledgerRepo: createFakeLedgerRepository(),
        depositRepo,
        outbox: outbox.port,
        billingConfig,
        logger: silentLogger,
      });

      await service.failDepositTransaction('d1', 'Cryptomus', 'fail');

      expect(depositRepo.deposits[0]!.status).toBe('CONFIRMED');
      expect(outbox.events).toHaveLength(0);
    });
  });
});
