import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { cryptomusRoutes } from '../cryptomus.routes';
import * as cryptomusService from '../cryptomus.service';
import { signRequestBody } from '../cryptomus.crypto';

jest.mock('../cryptomus.service');

describe('Cryptomus webhook route', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(cryptomusRoutes, { prefix: '/billing/cryptomus' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('captures raw body and forwards to service when registered with prefix', async () => {
    const mockHandle = jest.spyOn(cryptomusService, 'handleWebhookEvent').mockResolvedValue();

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
    expect(mockHandle).toHaveBeenCalledTimes(1);
    const [rawBody] = mockHandle.mock.calls[0]!;
    expect(typeof rawBody).toBe('string');
    expect(JSON.parse(rawBody)).toEqual(webhookBody);
  });

  it('returns 400 when service throws signature error', async () => {
    jest
      .spyOn(cryptomusService, 'handleWebhookEvent')
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
