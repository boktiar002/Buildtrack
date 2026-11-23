import { Global, Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';

/** Email (SMTP via nodemailer) and SMS delivery. */
@Global()
@Module({ providers: [MessagingService], exports: [MessagingService] })
export class MailModule {}
