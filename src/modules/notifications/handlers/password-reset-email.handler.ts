import type { Logger } from 'pino';
import type { OutboxHandler } from '../../../shared/outbox';
import type { EmailProvider } from '../utils/email-provider';
import { passwordResetEmail } from '../utils/email-templates';

interface HandlerDeps {
  emailProvider: EmailProvider;
  logger: Logger;
}

export function createPasswordResetEmailHandler(
  deps: HandlerDeps,
): OutboxHandler<'user.password_reset_requested'> {
  const { emailProvider, logger } = deps;
  return {
    eventType: 'user.password_reset_requested',
    name: 'password-reset-email',
    async handle(event): Promise<void> {
      logger.debug({ userId: event.payload.userId }, 'sending password reset email');
      const { subject, body } = passwordResetEmail(event.payload.resetUrl);
      try {
        await emailProvider.send({
          to: event.payload.email,
          subject,
          body,
        });
      } catch (err) {
        logger.error({ err, userId: event.payload.userId }, 'Failed to send password reset email');
        throw err;
      }
    },
  };
}
