import type { Logger } from 'pino';
import { createYandexMetrikaClient } from '../yandex-metrika.client';

const silentLogger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  child: (): Logger => silentLogger,
  level: 'silent',
  silent: jest.fn(),
} as unknown as Logger;

function okResponse(): Response {
  return { ok: true, status: 200, text: async () => '{"uploading":{}}' } as Response;
}

const conversion = {
  clientId: '1700000000000000000',
  target: 'purchase',
  price: 12.5,
  currency: 'USD',
  occurredAt: new Date('2026-06-20T10:00:00.000Z'),
};

describe('YandexMetrikaClient', () => {
  describe('when no OAuth token is configured', () => {
    it('isConfigured() is false and upload is a no-op (no network call)', async () => {
      const fetchMock = jest.fn();
      const client = createYandexMetrikaClient({
        config: { counterId: '109942271', oauthToken: undefined },
        logger: silentLogger,
        fetchImpl: fetchMock as unknown as typeof fetch,
      });

      expect(client.isConfigured()).toBe(false);
      await client.uploadOfflineConversion(conversion);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('when configured', () => {
    it('isConfigured() is true', () => {
      const client = createYandexMetrikaClient({
        config: { counterId: '42', oauthToken: 'tkn' },
        logger: silentLogger,
        fetchImpl: jest.fn() as unknown as typeof fetch,
      });
      expect(client.isConfigured()).toBe(true);
    });

    it('POSTs a CLIENT_ID offline conversion with the OAuth header and CSV body', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse());
      const client = createYandexMetrikaClient({
        config: { counterId: '42', oauthToken: 'secret-token' },
        logger: silentLogger,
        fetchImpl: fetchMock as unknown as typeof fetch,
      });

      await client.uploadOfflineConversion(conversion);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://api-metrika.yandex.net/management/v1/counter/42/offline_conversions/upload?client_id_type=CLIENT_ID',
      );
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>).Authorization).toBe('OAuth secret-token');

      const file = (init.body as FormData).get('file');
      const csv = await (file as Blob).text();
      const [header, row] = csv.trim().split('\n');
      expect(header).toBe('ClientId,Target,DateTime,Price,Currency');
      expect(row).toBe('1700000000000000000,purchase,1781949600,12.50,USD');
    });

    it('throws when Yandex responds with a non-2xx status (so the outbox retries)', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue({ ok: false, status: 403, text: async () => 'forbidden' } as Response);
      const client = createYandexMetrikaClient({
        config: { counterId: '42', oauthToken: 'secret-token' },
        logger: silentLogger,
        fetchImpl: fetchMock as unknown as typeof fetch,
      });

      await expect(client.uploadOfflineConversion(conversion)).rejects.toThrow(/403/);
    });
  });
});
