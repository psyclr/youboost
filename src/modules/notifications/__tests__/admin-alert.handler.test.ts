import type { Logger } from 'pino';
import { createAdminFulfilmentExhaustedHandler } from '../handlers/admin-alert.handler';
import type { EmailProvider } from '../utils/email-provider';

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

const event = {
  type: 'order.fulfilment_exhausted' as const,
  aggregateType: 'order' as const,
  aggregateId: 'ord-123456789',
  userId: 'u1',
  payload: { orderId: 'ord-123456789', userId: 'u1', attempts: 2 },
};

describe('admin fulfilment-exhausted handler', () => {
  it('emails the admin when ADMIN_ALERT_EMAIL is configured', async () => {
    const send = jest.fn(async () => undefined);
    const emailProvider = { send } as unknown as EmailProvider;
    const handler = createAdminFulfilmentExhaustedHandler({
      emailProvider,
      adminEmail: 'ops@youboost.store',
      logger: silentLogger,
    });

    await handler.handle(event, 'evt-1');

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@youboost.store',
        subject: expect.stringContaining('all panels failed'),
        body: expect.stringContaining('ord-1234'),
      }),
    );
  });

  it('does not email (no-op) when ADMIN_ALERT_EMAIL is unset', async () => {
    const send = jest.fn(async () => undefined);
    const emailProvider = { send } as unknown as EmailProvider;
    const handler = createAdminFulfilmentExhaustedHandler({
      emailProvider,
      adminEmail: undefined,
      logger: silentLogger,
    });

    await handler.handle(event, 'evt-1');

    expect(send).not.toHaveBeenCalled();
  });
});
