import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { createServiceLogger } from '../../../shared/utils/logger';
import type { EmailProvider } from './email-provider';

const log = createServiceLogger('nodemailer-email');

export class NodemailerEmailProvider implements EmailProvider {
  private readonly transporter: Transporter;

  constructor(config: {
    host: string;
    port: number;
    user: string | undefined;
    pass: string | undefined;
    from: string;
  }) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      ...(config.user && config.pass ? { auth: { user: config.user, pass: config.pass } } : {}),
    });
    this.from = config.from;
  }

  private readonly from: string;

  async send(params: { to: string; subject: string; body: string }): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.body,
    });
    log.info({ messageId: info.messageId, to: params.to }, 'Email sent');
  }
}
