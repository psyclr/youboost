import { createServiceLogger } from '../../../shared/utils/logger';
import { getConfig } from '../../../shared/config';
import type { EmailProvider } from './email-provider';
import { StubEmailProvider } from './stub-email-provider';
import { NodemailerEmailProvider } from './nodemailer-email-provider';

const log = createServiceLogger('email-provider-factory');

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;

  const { smtp } = getConfig();
  if (smtp.host) {
    log.info({ host: smtp.host }, 'Using Nodemailer email provider');
    provider = new NodemailerEmailProvider({
      host: smtp.host,
      port: smtp.port,
      user: smtp.user,
      pass: smtp.pass,
      from: smtp.from,
    });
  } else {
    log.info('Using stub email provider (SMTP_HOST not configured)');
    provider = new StubEmailProvider();
  }

  return provider;
}

export function resetEmailProvider(): void {
  provider = null;
}
