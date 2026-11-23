import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { withTimeout } from '../../common/utils/retry';
import { loadEnv } from '../../config/env';

/**
 * Email and SMS sending. Failures are logged and reported as `false`; they
 * never throw, so a mail server outage can never break a payment or update.
 * Without SMTP_HOST, emails are printed to the log (development mode).
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly transport: Transporter | null;

  constructor() {
    const env = loadEnv();
    this.transport = env.SMTP_HOST
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        })
      : null;
  }

  async email(to: string, subject: string, text: string, link?: string): Promise<boolean> {
    const env = loadEnv();
    const url = link ? `${env.WEB_ORIGIN}${link}` : null;
    const body = url ? `${text}\n\nOpen: ${url}` : text;
    if (!this.transport) {
      this.logger.log(`[email to ${to}] ${subject} :: ${body.replace(/\n/g, ' ')}`);
      return true;
    }
    try {
      await withTimeout(
        this.transport.sendMail({
          from: env.MAIL_FROM,
          to,
          subject,
          text: body,
          html: emailHtml(subject, text, url),
        }),
        20000,
        'Email',
      );
      return true;
    } catch (err) {
      this.logger.error({ err, to, subject }, 'Email failed');
      return false;
    }
  }

  async sms(phone: string | null | undefined, text: string): Promise<boolean> {
    if (!phone) return false;
    // Console provider for development. A real gateway plugs in here.
    this.logger.log(`[sms to ${phone}] ${text.slice(0, 160)}`);
    return true;
  }
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function emailHtml(subject: string, text: string, url: string | null) {
  return `<!doctype html><html><body style="margin:0;background:#FAF8F4;font-family:Arial,sans-serif;color:#111827">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #eee">
<tr><td style="padding:20px 24px;border-bottom:3px solid #C8A24A;font-size:18px;font-weight:bold;color:#1F2A37">BuildTrack</td></tr>
<tr><td style="padding:24px"><h2 style="margin:0 0 12px;font-size:18px;color:#1F2A37">${esc(subject)}</h2>
<p style="line-height:1.6;white-space:pre-line">${esc(text)}</p>
${url ? `<p style="margin-top:20px"><a href="${esc(url)}" style="background:#1F2A37;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open BuildTrack</a></p>` : ''}
</td></tr></table></td></tr></table></body></html>`;
}
