import type { Logger } from 'pino';
import type { OutboxHandler } from '../../../shared/outbox';
import type { EmailProvider } from '../utils/email-provider';
import { accountSetupEmail } from '../utils/email-templates';

interface HandlerDeps {
  emailProvider: EmailProvider;
  logger: Logger;
}

export function createAutoUserSetupEmailHandler(
  deps: HandlerDeps,
): OutboxHandler<'user.auto_registered'> {
  const { emailProvider, logger } = deps;
  return {
    eventType: 'user.auto_registered',
    name: 'auto-user-setup-email',
    async handle(event): Promise<void> {
      logger.debug({ userId: event.payload.userId }, 'sending auto-user setup email');
      const { subject, body } = accountSetupEmail(event.payload.setupUrl);
      try {
        await emailProvider.send({
          to: event.payload.email,
          subject,
          body,
        });
      } catch (err) {
        logger.error({ err, userId: event.payload.userId }, 'Failed to send auto-user setup email');
        throw err;
      }
    },
  };
}
