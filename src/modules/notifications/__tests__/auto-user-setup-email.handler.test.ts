import { createAutoUserSetupEmailHandler } from '../handlers/auto-user-setup-email.handler';
import { createFakeEmailProvider, silentLogger } from './fakes';
import type { OutboxEventOfType } from '../../../shared/outbox';

function makeEvent(
  overrides: Partial<OutboxEventOfType<'user.auto_registered'>['payload']> = {},
): OutboxEventOfType<'user.auto_registered'> {
  return {
    type: 'user.auto_registered',
    aggregateType: 'user',
    aggregateId: 'u1',
    userId: 'u1',
    payload: {
      userId: 'u1',
      email: 'guest@test.com',
      setupUrl: 'https://app.test/set-password?token=abc',
      ...overrides,
    },
  };
}

describe('auto-user-setup-email handler', () => {
  it('subscribes to user.auto_registered', () => {
    const handler = createAutoUserSetupEmailHandler({
      emailProvider: createFakeEmailProvider(),
      logger: silentLogger,
    });
    expect(handler.eventType).toBe('user.auto_registered');
  });

  it('sends the setup email to the customer with the setup link in the body', async () => {
    const emailProvider = createFakeEmailProvider();
    const handler = createAutoUserSetupEmailHandler({ emailProvider, logger: silentLogger });

    await handler.handle(makeEvent(), 'evt-1');

    expect(emailProvider.sent).toHaveLength(1);
    expect(emailProvider.sent[0]?.to).toBe('guest@test.com');
    expect(emailProvider.sent[0]?.body).toContain(
      'https://app.test/set-password?token=abc',
    );
  });

  it('rethrows on send failure so the outbox can retry', async () => {
    const emailProvider = createFakeEmailProvider();
    emailProvider.setFailure(new Error('smtp down'));
    const handler = createAutoUserSetupEmailHandler({ emailProvider, logger: silentLogger });

    await expect(handler.handle(makeEvent(), 'evt-1')).rejects.toThrow('smtp down');
  });
});
