import { createFundSettlement } from '../fund-settlement';
import type { OrderRecord } from '../../orders.types';
import { silentLogger, createFakeBilling } from '../../__tests__/fakes';

function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'order-1',
    userId: 'user-1',
    serviceId: 'svc-1',
    providerId: 'provider-1',
    externalOrderId: 'ext-1',
    link: 'https://youtube.com/watch?v=test',
    quantity: 1000,
    price: 10.0 as unknown as OrderRecord['price'],
    status: 'PROCESSING',
    startCount: null,
    remains: null,
    isDripFeed: false,
    dripFeedRuns: null,
    dripFeedInterval: null,
    dripFeedRunsCompleted: 0,
    dripFeedPausedAt: null,
    refillEligibleUntil: null,
    refillCount: 0,
    couponId: null,
    discount: 0 as unknown as OrderRecord['discount'],
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

describe('Fund Settlement (factory)', () => {
  describe('COMPLETED', () => {
    it('should charge full price', async () => {
      const billing = createFakeBilling();
      const fs = createFundSettlement({ billing, logger: silentLogger });
      await fs.settleFunds(makeOrder(), 'COMPLETED');
      expect(billing.calls.chargeFunds).toEqual([
        { userId: 'user-1', amount: 10, orderId: 'order-1' },
      ]);
      expect(billing.calls.releaseFunds).toHaveLength(0);
    });
  });

  describe('FAILED', () => {
    it('should release full price', async () => {
      const billing = createFakeBilling();
      const fs = createFundSettlement({ billing, logger: silentLogger });
      await fs.settleFunds(makeOrder(), 'FAILED');
      expect(billing.calls.releaseFunds).toEqual([
        { userId: 'user-1', amount: 10, orderId: 'order-1' },
      ]);
      expect(billing.calls.chargeFunds).toHaveLength(0);
    });
  });

  describe('PARTIAL', () => {
    it('should charge proportional amount and release remainder', async () => {
      const billing = createFakeBilling();
      const fs = createFundSettlement({ billing, logger: silentLogger });
      await fs.settleFunds(makeOrder({ quantity: 1000, remains: 200 }), 'PARTIAL');
      expect(billing.calls.chargeFunds).toEqual([
        { userId: 'user-1', amount: 8, orderId: 'order-1' },
      ]);
      expect(billing.calls.releaseFunds).toEqual([
        { userId: 'user-1', amount: 2, orderId: 'order-1' },
      ]);
    });

    it('should handle zero remains (all completed)', async () => {
      const billing = createFakeBilling();
      const fs = createFundSettlement({ billing, logger: silentLogger });
      await fs.settleFunds(makeOrder({ quantity: 1000, remains: 0 }), 'PARTIAL');
      expect(billing.calls.chargeFunds).toEqual([
        { userId: 'user-1', amount: 10, orderId: 'order-1' },
      ]);
      expect(billing.calls.releaseFunds).toHaveLength(0);
    });

    it('should handle null remains (treat as 0)', async () => {
      const billing = createFakeBilling();
      const fs = createFundSettlement({ billing, logger: silentLogger });
      await fs.settleFunds(makeOrder({ quantity: 1000, remains: null }), 'PARTIAL');
      expect(billing.calls.chargeFunds).toEqual([
        { userId: 'user-1', amount: 10, orderId: 'order-1' },
      ]);
      expect(billing.calls.releaseFunds).toHaveLength(0);
    });

    it('should round to 2 decimal places', async () => {
      const billing = createFakeBilling();
      const fs = createFundSettlement({ billing, logger: silentLogger });
      await fs.settleFunds(
        makeOrder({ quantity: 3, remains: 1, price: 10.0 as unknown as OrderRecord['price'] }),
        'PARTIAL',
      );
      expect(billing.calls.chargeFunds).toEqual([
        { userId: 'user-1', amount: 6.67, orderId: 'order-1' },
      ]);
      expect(billing.calls.releaseFunds).toEqual([
        { userId: 'user-1', amount: 3.33, orderId: 'order-1' },
      ]);
    });
  });

  describe('other statuses', () => {
    it('should not settle for CANCELLED', async () => {
      const billing = createFakeBilling();
      const fs = createFundSettlement({ billing, logger: silentLogger });
      await fs.settleFunds(makeOrder(), 'CANCELLED');
      expect(billing.calls.chargeFunds).toHaveLength(0);
      expect(billing.calls.releaseFunds).toHaveLength(0);
    });

    it('should not settle for REFUNDED', async () => {
      const billing = createFakeBilling();
      const fs = createFundSettlement({ billing, logger: silentLogger });
      await fs.settleFunds(makeOrder(), 'REFUNDED');
      expect(billing.calls.chargeFunds).toHaveLength(0);
      expect(billing.calls.releaseFunds).toHaveLength(0);
    });
  });
});
