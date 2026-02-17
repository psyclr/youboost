import { adjustBalance } from '../admin-billing.service';

const mockAdjustBalance = jest.fn();

jest.mock('../../billing/billing-internal.service', () => ({
  adjustBalance: (...args: unknown[]): unknown => mockAdjustBalance(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Admin Billing Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('adjustBalance', () => {
    it('should call billingInternal.adjustBalance with positive amount', async () => {
      mockAdjustBalance.mockResolvedValue(undefined);

      await adjustBalance('user-1', { amount: 100, reason: 'Bonus' });

      expect(mockAdjustBalance).toHaveBeenCalledWith('user-1', 100, 'Bonus');
    });

    it('should call billingInternal.adjustBalance with negative amount', async () => {
      mockAdjustBalance.mockResolvedValue(undefined);

      await adjustBalance('user-1', { amount: -50, reason: 'Penalty' });

      expect(mockAdjustBalance).toHaveBeenCalledWith('user-1', -50, 'Penalty');
    });

    it('should propagate error on insufficient funds', async () => {
      mockAdjustBalance.mockRejectedValue(new Error('Insufficient funds for adjustment'));

      await expect(
        adjustBalance('user-1', { amount: -1000, reason: 'Big penalty' }),
      ).rejects.toThrow('Insufficient funds for adjustment');
    });

    it('should call adjustBalance with zero amount', async () => {
      mockAdjustBalance.mockResolvedValue(undefined);

      await adjustBalance('user-1', { amount: 0, reason: 'Test adjustment' });

      expect(mockAdjustBalance).toHaveBeenCalledWith('user-1', 0, 'Test adjustment');
    });
  });
});
