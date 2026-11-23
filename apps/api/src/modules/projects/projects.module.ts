import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HandoverDateChange } from './entities/handover-date-change.entity';
import { Milestone } from './entities/milestone.entity';
import { ProjectAssignment } from './entities/project-assignment.entity';
import { Project } from './entities/project.entity';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Milestone, ProjectAssignment, HandoverDateChange])],
  controllers: [ProjectsController, MilestonesController],
  providers: [ProjectsService, MilestonesService],
  exports: [ProjectsService, MilestonesService],
})
export class ProjectsModule {}
