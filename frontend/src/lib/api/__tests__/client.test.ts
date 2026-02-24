import { apiRequest, setAuthHandlers, ApiError } from '../client';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('apiRequest', () => {
  let mockGetToken: jest.Mock;
  let mockRefreshToken: jest.Mock;
  let mockOnFailure: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken = jest.fn().mockReturnValue(null);
    mockRefreshToken = jest.fn().mockResolvedValue(null);
    mockOnFailure = jest.fn();
    setAuthHandlers(mockGetToken, mockRefreshToken, mockOnFailure);
  });

  it('should make GET request to /api + path', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' }),
    });

    await apiRequest('/users');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('should attach Authorization header when token is available', async () => {
    mockGetToken.mockReturnValue('my-token');
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' }),
    });

    await apiRequest('/users');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
      }),
    );
  });

  it('should retry with refreshed token on 401', async () => {
    mockGetToken.mockReturnValue('expired-token');
    mockRefreshToken.mockResolvedValue('new-token');

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'refreshed' }),
      });

    const result = await apiRequest('/users');

    expect(mockRefreshToken).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: 'refreshed' });
  });

  it('should call onAuthFailure and throw when refresh fails', async () => {
    mockGetToken.mockReturnValue('expired-token');
    mockRefreshToken.mockResolvedValue(null);
    mockFetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    await expect(apiRequest('/users')).rejects.toThrow(ApiError);
    expect(mockOnFailure).toHaveBeenCalled();
  });

  it('should return undefined for 204 responses', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    const result = await apiRequest('/users/1');

    expect(result).toBeUndefined();
  });

  it('should throw ApiError on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: 'BAD_REQUEST', message: 'Invalid input', details: null },
      }),
    });

    try {
      await apiRequest('/users');
      fail('Expected error to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('BAD_REQUEST');
      expect((err as ApiError).message).toBe('Invalid input');
      expect((err as ApiError).status).toBe(400);
    }
  });
});
