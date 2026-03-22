import { createServiceLogger } from '../../../shared/utils/logger';
import type { EmailProvider } from './email-provider';
import { StubEmailProvider } from './stub-email-provider';
import { NodemailerEmailProvider } from './nodemailer-email-provider';

const log = createServiceLogger('email-provider-factory');

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;

  const smtpHost = process.env['SMTP_HOST'];
  if (smtpHost) {
    log.info({ host: smtpHost }, 'Using Nodemailer email provider');
    provider = new NodemailerEmailProvider({
      host: smtpHost,
      port: Number.parseInt(process.env['SMTP_PORT'] ?? '587', 10),
      user: process.env['SMTP_USER'] ?? undefined,
      pass: process.env['SMTP_PASS'] ?? undefined,
      from: process.env['SMTP_FROM'] ?? 'YouBoost <noreply@youboost.io>',
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
