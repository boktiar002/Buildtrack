import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SchedulerService } from './scheduler.service';

/** Daily 08:00 (Asia/Dhaka) job: installment statuses, reminders, overdue summary, risk scores. */
@Module({ imports: [AiModule], providers: [SchedulerService], exports: [SchedulerService] })
export class SchedulerModule {}
