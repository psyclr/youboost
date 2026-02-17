import { createServiceLogger } from '../../../shared/utils/logger';
import type { EmailProvider } from './email-provider';

const log = createServiceLogger('stub-email');

export class StubEmailProvider implements EmailProvider {
  async send(params: { to: string; subject: string; body: string }): Promise<void> {
    log.info({ to: params.to, subject: params.subject }, 'Stub email sent');
  }
}

export const emailProvider: EmailProvider = new StubEmailProvider();
