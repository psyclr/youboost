import type { Logger } from 'pino';
import type { OutboxHandler } from '../../../shared/outbox';
import type { EmailProvider } from '../utils/email-provider';
import { verificationEmail } from '../utils/email-templates';

interface HandlerDeps {
  emailProvider: EmailProvider;
  logger: Logger;
}

export function createVerificationEmailHandler(
  deps: HandlerDeps,
): OutboxHandler<'user.email_verification_requested'> {
  const { emailProvider, logger } = deps;
  return {
    eventType: 'user.email_verification_requested',
    name: 'verification-email',
    async handle(event): Promise<void> {
      logger.debug({ userId: event.payload.userId }, 'sending verification email');
      const { subject, body } = verificationEmail(event.payload.verifyUrl);
      try {
        await emailProvider.send({
          to: event.payload.email,
          subject,
          body,
        });
      } catch (err) {
        logger.error({ err, userId: event.payload.userId }, 'Failed to send verification email');
        throw err;
      }
    },
  };
}
