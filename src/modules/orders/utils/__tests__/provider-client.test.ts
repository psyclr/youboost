import { providerClient } from '../stub-provider-client';

describe('StubProviderClient', () => {
  describe('submitOrder', () => {
    it('should return an externalOrderId and status', async () => {
      const result = await providerClient.submitOrder({
        serviceId: 'svc-1',
        link: 'https://youtube.com/watch?v=test',
        quantity: 1000,
      });

      expect(result.externalOrderId).toBeDefined();
      expect(typeof result.externalOrderId).toBe('string');
      expect(result.status).toContain('processing');
    });

    it('should generate unique order IDs', async () => {
      const params = {
        serviceId: 'svc-1',
        link: 'https://youtube.com/watch?v=test',
        quantity: 100,
      };
      const r1 = await providerClient.submitOrder(params);
      const r2 = await providerClient.submitOrder(params);

      expect(r1.externalOrderId).not.toBe(r2.externalOrderId);
    });
  });

  describe('checkStatus', () => {
    it('should return status result', async () => {
      const result = await providerClient.checkStatus('ext-order-1');

      expect(result.status).toBe('processing');
      expect(typeof result.startCount).toBe('number');
      expect(typeof result.completed).toBe('number');
      expect(typeof result.remains).toBe('number');
    });
  });
});
