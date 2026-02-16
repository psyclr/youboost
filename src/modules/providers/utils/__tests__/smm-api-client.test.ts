import { createSmmApiClient } from '../smm-api-client';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

describe('SMM API Client', () => {
  const client = createSmmApiClient({
    apiEndpoint: 'https://provider.example.com/api/v2',
    apiKey: 'test-api-key',
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitOrder', () => {
    it('should submit order and return external ID', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ order: 12345 }));

      const result = await client.submitOrder({
        serviceId: '100',
        link: 'https://youtube.com/watch?v=test',
        quantity: 1000,
      });

      expect(result.externalOrderId).toBe('12345');
      expect(result.status).toBe('processing');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://provider.example.com/api/v2',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should send correct form data', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ order: 1 }));

      await client.submitOrder({
        serviceId: '200',
        link: 'https://example.com',
        quantity: 500,
      });

      const body = mockFetch.mock.calls[0][1].body as string;
      expect(body).toContain('key=test-api-key');
      expect(body).toContain('action=add');
      expect(body).toContain('service=200');
      expect(body).toContain('quantity=500');
    });

    it('should throw on provider error response', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Insufficient funds' }));

      await expect(
        client.submitOrder({ serviceId: '100', link: 'https://yt.com', quantity: 100 }),
      ).rejects.toThrow('Provider error: Insufficient funds');
    });

    it('should throw when no order ID returned', async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await expect(
        client.submitOrder({ serviceId: '100', link: 'https://yt.com', quantity: 100 }),
      ).rejects.toThrow('Provider returned no order ID');
    });
  });

  describe('checkStatus', () => {
    it('should return status result', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          charge: '0.50',
          start_count: '1000',
          status: 'Completed',
          remains: '0',
        }),
      );

      const result = await client.checkStatus('12345');

      expect(result.status).toBe('Completed');
      expect(result.startCount).toBe(1000);
      expect(result.remains).toBe(0);
    });

    it('should send correct form data for status', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'In progress', remains: '500' }));

      await client.checkStatus('99999');

      const body = mockFetch.mock.calls[0][1].body as string;
      expect(body).toContain('key=test-api-key');
      expect(body).toContain('action=status');
      expect(body).toContain('order=99999');
    });

    it('should throw on provider error response', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Order not found' }));

      await expect(client.checkStatus('bad-id')).rejects.toThrow('Provider error: Order not found');
    });
  });
});
