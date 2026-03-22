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

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        client.submitOrder({ serviceId: '100', link: 'https://yt.com', quantity: 100 }),
      ).rejects.toThrow('Provider API request failed');
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

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.checkStatus('12345')).rejects.toThrow('Provider API request failed');
    });
  });

  describe('fetchServices', () => {
    it('should return parsed services array', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse([
          {
            service: '201',
            name: 'YouTube Views',
            type: 'Default',
            category: 'YouTube',
            rate: '1.50',
            min: '100',
            max: '1000000',
            description: 'HQ views',
          },
          {
            service: '202',
            name: 'Instagram Likes',
            type: 'Default',
            category: 'Instagram',
            rate: '2.00',
            min: '50',
            max: '50000',
          },
        ]),
      );

      const result = await client.fetchServices();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        serviceId: '201',
        name: 'YouTube Views',
        type: 'Default',
        category: 'YouTube',
        rate: 1.5,
        min: 100,
        max: 1000000,
        description: 'HQ views',
      });
    });

    it('should send correct form data for services', async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));

      await client.fetchServices();

      const body = mockFetch.mock.calls[0][1].body as string;
      expect(body).toContain('key=test-api-key');
      expect(body).toContain('action=services');
    });

    it('should throw on provider error response', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Authentication failed' }));

      await expect(client.fetchServices()).rejects.toThrow('Provider error: Authentication failed');
    });

    it('should return empty array for non-array response', async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      const result = await client.fetchServices();

      expect(result).toEqual([]);
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.fetchServices()).rejects.toThrow('Provider API request failed');
    });
  });

  describe('checkBalance', () => {
    it('should return balance info', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ balance: '150.25', currency: 'USD' }));

      const result = await client.checkBalance();

      expect(result.balance).toBe(150.25);
      expect(result.currency).toBe('USD');
    });

    it('should send correct form data for balance', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ balance: '0', currency: 'USD' }));

      await client.checkBalance();

      const body = mockFetch.mock.calls[0][1].body as string;
      expect(body).toContain('key=test-api-key');
      expect(body).toContain('action=balance');
    });

    it('should throw on provider error response', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Invalid API key' }));

      await expect(client.checkBalance()).rejects.toThrow('Provider error: Invalid API key');
    });

    it('should default currency to USD when not provided', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ balance: '50' }));

      const result = await client.checkBalance();

      expect(result.currency).toBe('USD');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.checkBalance()).rejects.toThrow('Provider API request failed');
    });
  });
});
