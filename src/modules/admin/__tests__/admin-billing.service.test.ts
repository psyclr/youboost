import { createAdminBillingService } from '../admin-billing.service';
import { silentLogger } from './fakes';

describe('Admin Billing Service', () => {
  describe('adjustBalance', () => {
    it('should call billingInternal.adjustBalance with positive amount', async () => {
      const adjustBalance = jest.fn().mockResolvedValue(undefined);
      const service = createAdminBillingService({ adjustBalance, logger: silentLogger });

      await service.adjustBalance('user-1', { amount: 100, reason: 'Bonus' });

      expect(adjustBalance).toHaveBeenCalledWith('user-1', 100, 'Bonus');
    });

    it('should call billingInternal.adjustBalance with negative amount', async () => {
      const adjustBalance = jest.fn().mockResolvedValue(undefined);
      const service = createAdminBillingService({ adjustBalance, logger: silentLogger });

      await service.adjustBalance('user-1', { amount: -50, reason: 'Penalty' });

      expect(adjustBalance).toHaveBeenCalledWith('user-1', -50, 'Penalty');
    });

    it('should propagate error on insufficient funds', async () => {
      const adjustBalance = jest
        .fn()
        .mockRejectedValue(new Error('Insufficient funds for adjustment'));
      const service = createAdminBillingService({ adjustBalance, logger: silentLogger });

      await expect(
        service.adjustBalance('user-1', { amount: -1000, reason: 'Big penalty' }),
      ).rejects.toThrow('Insufficient funds for adjustment');
    });

    it('should call adjustBalance with zero amount', async () => {
      const adjustBalance = jest.fn().mockResolvedValue(undefined);
      const service = createAdminBillingService({ adjustBalance, logger: silentLogger });

      await service.adjustBalance('user-1', { amount: 0, reason: 'Test adjustment' });

      expect(adjustBalance).toHaveBeenCalledWith('user-1', 0, 'Test adjustment');
    });
  });
});
