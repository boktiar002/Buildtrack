import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ProjectsModule } from '../projects/projects.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { UpdatesModule } from '../updates/updates.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ProjectsModule, UpdatesModule, AiModule, SchedulerModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
