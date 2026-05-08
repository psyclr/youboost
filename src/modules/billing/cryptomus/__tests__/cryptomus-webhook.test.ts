import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { createCryptomusRoutes } from '../cryptomus.routes';
import { createCryptomusPaymentService, type CryptomusPaymentService } from '../cryptomus.service';
import { signRequestBody } from '../cryptomus.crypto';
import { createFakeDepositRepository, silentLogger } from '../../__tests__/fakes';
import type { DepositLifecycleService } from '../../deposit-lifecycle.service';

function makeLifecycle(): jest.Mocked<DepositLifecycleService> {
  return {
    prepareDepositCheckout: jest.fn(),
    confirmDepositTransaction: jest.fn(),
    failDepositTransaction: jest.fn(),
  };
}

function makeService(): CryptomusPaymentService {
  return createCryptomusPaymentService({
    depositRepo: createFakeDepositRepository(),
    lifecycle: makeLifecycle(),
    cryptomusConfig: { merchantId: 'm', paymentKey: 'p', callbackUrl: 'https://cb' },
    appUrl: 'http://localhost:3000',
    logger: silentLogger,
  });
}

const passThroughAuth = async (): Promise<void> => {
  // no-op
};

describe('Cryptomus webhook route', () => {
  let app: FastifyInstance;
  let service: CryptomusPaymentService;

  beforeEach(async () => {
    app = Fastify();
    service = makeService();
    await app.register(createCryptomusRoutes({ service, authenticate: passThroughAuth }), {
      prefix: '/billing/cryptomus',
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('captures raw body and forwards to service when registered with prefix', async () => {
    const spy = jest.spyOn(service, 'handleWebhookEvent').mockResolvedValue();

    const bodyObj = { order_id: 'dep-123', status: 'paid', amount: '25.00' };
    const unsignedJson = JSON.stringify(bodyObj);
    const sign = signRequestBody(unsignedJson, 'ignored-for-mock');
    const webhookBody = { ...bodyObj, sign };

    const res = await app.inject({
      method: 'POST',
      url: '/billing/cryptomus/webhook',
      headers: { 'content-type': 'application/json' },
      payload: webhookBody,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ received: true });
    expect(spy).toHaveBeenCalledTimes(1);
    const [rawBody] = spy.mock.calls[0]!;
    expect(typeof rawBody).toBe('string');
    expect(JSON.parse(rawBody)).toEqual(webhookBody);
  });

  it('returns 400 when service throws signature error', async () => {
    jest
      .spyOn(service, 'handleWebhookEvent')
      .mockRejectedValue(new Error('Invalid Cryptomus webhook signature'));

    const res = await app.inject({
      method: 'POST',
      url: '/billing/cryptomus/webhook',
      headers: { 'content-type': 'application/json' },
      payload: { order_id: 'x', status: 'paid', sign: 'bad' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Invalid Cryptomus webhook signature' });
  });
});
