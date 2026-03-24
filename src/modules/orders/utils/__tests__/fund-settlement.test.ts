import { settleFunds } from '../fund-settlement';
import type { OrderRecord } from '../../orders.types';

const mockChargeFunds = jest.fn().mockResolvedValue(undefined);
const mockReleaseFunds = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../billing', () => ({
  chargeFunds: (...args: unknown[]): unknown => mockChargeFunds(...args),
  releaseFunds: (...args: unknown[]): unknown => mockReleaseFunds(...args),
}));

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

describe('Fund Settlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('COMPLETED', () => {
    it('should charge full price', async () => {
      const order = makeOrder();
      await settleFunds(order, 'COMPLETED');

      expect(mockChargeFunds).toHaveBeenCalledWith('user-1', 10, 'order-1');
      expect(mockReleaseFunds).not.toHaveBeenCalled();
    });
  });

  describe('FAILED', () => {
    it('should release full price', async () => {
      const order = makeOrder();
      await settleFunds(order, 'FAILED');

      expect(mockReleaseFunds).toHaveBeenCalledWith('user-1', 10, 'order-1');
      expect(mockChargeFunds).not.toHaveBeenCalled();
    });
  });

  describe('PARTIAL', () => {
    it('should charge proportional amount and release remainder', async () => {
      const order = makeOrder({ quantity: 1000, remains: 200 });
      await settleFunds(order, 'PARTIAL');

      // completedRatio = (1000 - 200) / 1000 = 0.8
      // charge = 10 * 0.8 = 8.00
      // release = 10 - 8 = 2.00
      expect(mockChargeFunds).toHaveBeenCalledWith('user-1', 8, 'order-1');
      expect(mockReleaseFunds).toHaveBeenCalledWith('user-1', 2, 'order-1');
    });

    it('should handle zero remains (all completed)', async () => {
      const order = makeOrder({ quantity: 1000, remains: 0 });
      await settleFunds(order, 'PARTIAL');

      expect(mockChargeFunds).toHaveBeenCalledWith('user-1', 10, 'order-1');
      expect(mockReleaseFunds).not.toHaveBeenCalled();
    });

    it('should handle null remains (treat as 0)', async () => {
      const order = makeOrder({ quantity: 1000, remains: null });
      await settleFunds(order, 'PARTIAL');

      expect(mockChargeFunds).toHaveBeenCalledWith('user-1', 10, 'order-1');
      expect(mockReleaseFunds).not.toHaveBeenCalled();
    });

    it('should round to 2 decimal places', async () => {
      const order = makeOrder({
        quantity: 3,
        remains: 1,
        price: 10.0 as unknown as OrderRecord['price'],
      });
      await settleFunds(order, 'PARTIAL');

      // completedRatio = (3 - 1) / 3 = 0.6667
      // charge = 10 * 0.6667 = 6.67
      // release = 10 - 6.67 = 3.33
      expect(mockChargeFunds).toHaveBeenCalledWith('user-1', 6.67, 'order-1');
      expect(mockReleaseFunds).toHaveBeenCalledWith('user-1', 3.33, 'order-1');
    });
  });

  describe('other statuses', () => {
    it('should not settle for CANCELLED', async () => {
      const order = makeOrder();
      await settleFunds(order, 'CANCELLED');

      expect(mockChargeFunds).not.toHaveBeenCalled();
      expect(mockReleaseFunds).not.toHaveBeenCalled();
    });

    it('should not settle for REFUNDED', async () => {
      const order = makeOrder();
      await settleFunds(order, 'REFUNDED');

      expect(mockChargeFunds).not.toHaveBeenCalled();
      expect(mockReleaseFunds).not.toHaveBeenCalled();
    });
  });
});
