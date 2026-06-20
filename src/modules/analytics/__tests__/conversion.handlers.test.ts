import type { Logger } from 'pino';
import {
  createPurchaseConversionHandler,
  createDepositConversionHandler,
} from '../handlers/conversion.handlers';
import type { YandexMetrikaClient } from '../yandex-metrika.client';

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

function fakeClient(): jest.Mocked<YandexMetrikaClient> {
  return {
    isConfigured: jest.fn().mockReturnValue(true),
    uploadOfflineConversion: jest.fn().mockResolvedValue(undefined),
  };
}

describe('purchase conversion handler', () => {
  it('uploads a purchase conversion with the configured target and payment amount', async () => {
    const metrikaClient = fakeClient();
    const handler = createPurchaseConversionHandler({
      metrikaClient,
      target: 'purchase',
      logger: silentLogger,
    });

    await handler.handle(
      {
        type: 'payment.confirmed',
        aggregateType: 'payment',
        aggregateId: 'p1',
        userId: 'u1',
        payload: {
          paymentId: 'p1',
          userId: 'u1',
          amount: 19.99,
          currency: 'USD',
          metrikaClientId: 'client-123',
        },
      },
      'event-1',
    );

    expect(metrikaClient.uploadOfflineConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-123',
        target: 'purchase',
        price: 19.99,
        currency: 'USD',
      }),
    );
  });

  it('skips the upload when no ClientID was captured', async () => {
    const metrikaClient = fakeClient();
    const handler = createPurchaseConversionHandler({
      metrikaClient,
      target: 'purchase',
      logger: silentLogger,
    });

    await handler.handle(
      {
        type: 'payment.confirmed',
        aggregateType: 'payment',
        aggregateId: 'p1',
        userId: 'u1',
        payload: {
          paymentId: 'p1',
          userId: 'u1',
          amount: 5,
          currency: 'USD',
          metrikaClientId: null,
        },
      },
      'event-1',
    );

    expect(metrikaClient.uploadOfflineConversion).not.toHaveBeenCalled();
  });
});

describe('deposit conversion handler', () => {
  it('uploads a deposit conversion in USD with the configured target', async () => {
    const metrikaClient = fakeClient();
    const handler = createDepositConversionHandler({
      metrikaClient,
      target: 'deposit',
      logger: silentLogger,
    });

    await handler.handle(
      {
        type: 'deposit.confirmed',
        aggregateType: 'deposit',
        aggregateId: 'd1',
        userId: 'u1',
        payload: {
          depositId: 'd1',
          userId: 'u1',
          amount: 50,
          provider: 'Cryptomus',
          metrikaClientId: 'client-xyz',
        },
      },
      'event-2',
    );

    expect(metrikaClient.uploadOfflineConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-xyz',
        target: 'deposit',
        price: 50,
        currency: 'USD',
      }),
    );
  });
});
