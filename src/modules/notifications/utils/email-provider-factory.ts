import type { Logger } from 'pino';
import type { EmailProvider } from './email-provider';
import { StubEmailProvider } from './stub-email-provider';
import { NodemailerEmailProvider } from './nodemailer-email-provider';

export interface SmtpConfig {
  host: string | undefined;
  port: number;
  user: string | undefined;
  pass: string | undefined;
  from: string;
}

export interface CreateEmailProviderDeps {
  smtp: SmtpConfig;
  logger: Logger;
}

export function createEmailProvider(deps: CreateEmailProviderDeps): EmailProvider {
  const { smtp, logger } = deps;

  if (smtp.host) {
    logger.info({ host: smtp.host }, 'Using Nodemailer email provider');
    return new NodemailerEmailProvider({
      host: smtp.host,
      port: smtp.port,
      user: smtp.user,
      pass: smtp.pass,
      from: smtp.from,
    });
  }

  logger.info('Using stub email provider (SMTP_HOST not configured)');
  return new StubEmailProvider();
}
