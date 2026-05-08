import { createBillingInternalService } from '../billing-internal.service';
import {
  createFakePrisma,
  createFakeWalletRepository,
  createFakeLedgerRepository,
  silentLogger,
} from './fakes';

function makeService(walletSeed: { balance?: number; holdAmount?: number } = {}) {
  const prisma = createFakePrisma();
  const walletRepo = createFakeWalletRepository({
    userId: 'user-1',
    walletId: 'wallet-1',
    balance: walletSeed.balance ?? 100,
    holdAmount: walletSeed.holdAmount ?? 20,
  });
  const ledgerRepo = createFakeLedgerRepository();
  const service = createBillingInternalService({
    prisma: prisma.client,
    walletRepo,
    ledgerRepo,
    logger: silentLogger,
  });
  return { service, prisma, walletRepo, ledgerRepo };
}

describe('Billing Internal Service', () => {
  describe('holdFunds', () => {
    it('should hold funds when available balance is sufficient', async () => {
      const { service, walletRepo, ledgerRepo } = makeService();

      await service.holdFunds('user-1', 30, 'order-1');

      const w = walletRepo._walletsByKey.get('user-1:USD')!;
      expect(Number(w.balance)).toBe(100);
      expect(Number(w.holdAmount)).toBe(50);
      expect(ledgerRepo.createCalls).toHaveLength(1);
      expect(ledgerRepo.createCalls[0]!.data).toMatchObject({
        type: 'HOLD',
        amount: 30,
        referenceId: 'order-1',
      });
    });

    it('should throw when available balance is insufficient', async () => {
      const { service } = makeService({ balance: 100, holdAmount: 20 });
      await expect(service.holdFunds('user-1', 90, 'order-1')).rejects.toThrow(
        'Insufficient funds',
      );
    });

    it('should hold exact available amount', async () => {
      const { service, walletRepo } = makeService();

      await service.holdFunds('user-1', 80, 'order-1');

      const w = walletRepo._walletsByKey.get('user-1:USD')!;
      expect(Number(w.holdAmount)).toBe(100);
    });

    it('should set referenceType to order', async () => {
      const { service, ledgerRepo } = makeService();
      await service.holdFunds('user-1', 10, 'order-1');
      expect(ledgerRepo.createCalls[0]!.data.referenceType).toBe('order');
    });
  });

  describe('releaseFunds', () => {
    it('should release funds and decrease hold', async () => {
      const { service, walletRepo, ledgerRepo } = makeService();

      await service.releaseFunds('user-1', 10, 'order-1');

      const w = walletRepo._walletsByKey.get('user-1:USD')!;
      expect(Number(w.balance)).toBe(100);
      expect(Number(w.holdAmount)).toBe(10);
      expect(ledgerRepo.createCalls[0]!.data).toMatchObject({ type: 'RELEASE', amount: 10 });
    });

    it('should throw when hold is insufficient', async () => {
      const { service } = makeService();
      await expect(service.releaseFunds('user-1', 30, 'order-1')).rejects.toThrow(
        'Insufficient hold',
      );
    });

    it('should release exact hold amount', async () => {
      const { service, walletRepo } = makeService();

      await service.releaseFunds('user-1', 20, 'order-1');

      const w = walletRepo._walletsByKey.get('user-1:USD')!;
      expect(Number(w.holdAmount)).toBe(0);
    });
  });

  describe('chargeFunds', () => {
    it('should charge funds by decreasing balance and hold', async () => {
      const { service, walletRepo, ledgerRepo } = makeService();

      await service.chargeFunds('user-1', 15, 'order-1');

      const w = walletRepo._walletsByKey.get('user-1:USD')!;
      expect(Number(w.balance)).toBe(85);
      expect(Number(w.holdAmount)).toBe(5);
      expect(ledgerRepo.createCalls[0]!.data).toMatchObject({
        type: 'WITHDRAW',
        amount: 15,
        balanceBefore: 100,
        balanceAfter: 85,
      });
    });

    it('should throw when hold is insufficient for charge', async () => {
      const { service } = makeService();
      await expect(service.chargeFunds('user-1', 25, 'order-1')).rejects.toThrow(
        'Insufficient hold',
      );
    });

    it('should charge exact hold amount', async () => {
      const { service, walletRepo } = makeService();

      await service.chargeFunds('user-1', 20, 'order-1');

      const w = walletRepo._walletsByKey.get('user-1:USD')!;
      expect(Number(w.balance)).toBe(80);
      expect(Number(w.holdAmount)).toBe(0);
    });
  });

  describe('refundFunds', () => {
    it('should refund by increasing balance', async () => {
      const { service, walletRepo, ledgerRepo } = makeService();

      await service.refundFunds('user-1', 25, 'order-1');

      const w = walletRepo._walletsByKey.get('user-1:USD')!;
      expect(Number(w.balance)).toBe(125);
      expect(Number(w.holdAmount)).toBe(20);
      expect(ledgerRepo.createCalls[0]!.data).toMatchObject({
        type: 'REFUND',
        amount: 25,
        balanceBefore: 100,
        balanceAfter: 125,
      });
    });

    it('should set correct description', async () => {
      const { service, ledgerRepo } = makeService();
      await service.refundFunds('user-1', 10, 'order-99');
      expect(ledgerRepo.createCalls[0]!.data.description).toBe('Refund 10 for order order-99');
    });

    it('should not change hold amount on refund', async () => {
      const { service, walletRepo } = makeService();
      await service.refundFunds('user-1', 10, 'order-1');
      const w = walletRepo._walletsByKey.get('user-1:USD')!;
      expect(Number(w.balance)).toBe(110);
      expect(Number(w.holdAmount)).toBe(20);
    });
  });

  describe('adjustBalance', () => {
    it('should increase balance with positive amount', async () => {
      const { service, walletRepo, ledgerRepo } = makeService();

      await service.adjustBalance('user-1', 50, 'Bonus');

      const w = walletRepo._walletsByKey.get('user-1:USD')!;
      expect(Number(w.balance)).toBe(150);
      expect(Number(w.holdAmount)).toBe(20);
      expect(ledgerRepo.createCalls[0]!.data).toMatchObject({
        type: 'ADMIN_ADJUSTMENT',
        amount: 50,
        balanceAfter: 150,
        description: 'Bonus',
      });
    });

    it('should decrease balance with negative amount', async () => {
      const { service, walletRepo } = makeService();
      await service.adjustBalance('user-1', -30, 'Penalty');
      const w = walletRepo._walletsByKey.get('user-1:USD')!;
      expect(Number(w.balance)).toBe(70);
      expect(Number(w.holdAmount)).toBe(20);
    });

    it('should throw when negative adjustment exceeds balance', async () => {
      const { service } = makeService();
      await expect(service.adjustBalance('user-1', -200, 'Too much')).rejects.toThrow(
        'Insufficient funds',
      );
    });

    it('should use referenceType admin', async () => {
      const { service, ledgerRepo } = makeService();
      await service.adjustBalance('user-1', 10, 'Test');
      expect(ledgerRepo.createCalls[0]!.data.referenceType).toBe('admin');
    });
  });
});
