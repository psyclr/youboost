import { apiRequestValidated, setAuthHandlers, ApiError } from '../client';
import { balanceResponseSchema, landingCartCheckoutResultSchema } from '../schemas';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('apiRequestValidated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAuthHandlers(
      () => null,
      async () => null,
      () => {},
    );
  });

  it('parses a valid money payload and returns the typed data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        userId: 'u1',
        balance: 12.5,
        frozen: 2,
        available: 10.5,
        currency: 'USD',
      }),
    });

    const result = await apiRequestValidated<{ balance: number }>(
      '/billing/balance',
      balanceResponseSchema,
    );

    expect(result.balance).toBe(12.5);
  });

  it('throws an ApiError with code INVALID_RESPONSE when a money field is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ userId: 'u1', frozen: 2, available: 10.5, currency: 'USD' }),
    });

    try {
      await apiRequestValidated('/billing/balance', balanceResponseSchema);
      fail('Expected error to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('INVALID_RESPONSE');
      expect((err as ApiError).status).toBe(502);
    }
  });

  it('throws INVALID_RESPONSE when a money field has the wrong type', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ balance: 'abc', frozen: 0, available: 0 }),
    });

    await expect(apiRequestValidated('/billing/balance', balanceResponseSchema)).rejects.toThrow(
      ApiError,
    );
  });

  it('does NOT throw on an extra unexpected field (loose schema passes it through)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        balance: 1,
        frozen: 0,
        available: 1,
        // brand-new backend field the frontend does not know about yet:
        pendingWithdrawals: 99,
      }),
    });

    await expect(
      apiRequestValidated<{ balance: number }>('/billing/balance', balanceResponseSchema),
    ).resolves.toEqual(
      expect.objectContaining({ balance: 1, frozen: 0, available: 1, pendingWithdrawals: 99 }),
    );
  });

  it('validates the landing cart checkout (pay URL) response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        userId: 'u1',
        paymentId: 'p1',
        orderIds: ['o1', 'o2'],
        checkoutUrl: 'https://pay.example/checkout',
      }),
    });

    const result = await apiRequestValidated<{ checkoutUrl: string }>(
      '/landing/foo/checkout/cart',
      landingCartCheckoutResultSchema,
      { method: 'POST', body: '{}' },
    );

    expect(result.checkoutUrl).toBe('https://pay.example/checkout');
  });

  it('throws INVALID_RESPONSE when the cart pay URL is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ userId: 'u1', paymentId: 'p1', orderIds: ['o1'] }),
    });

    await expect(
      apiRequestValidated('/landing/foo/checkout/cart', landingCartCheckoutResultSchema, {
        method: 'POST',
        body: '{}',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });

  it('propagates a non-ok ApiError unchanged (validation only runs on success)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'BAD_REQUEST', message: 'Invalid input' } }),
    });

    await expect(
      apiRequestValidated('/billing/balance', balanceResponseSchema),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
  });
});
