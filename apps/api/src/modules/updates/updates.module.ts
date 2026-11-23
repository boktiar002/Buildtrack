import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProgressPhoto } from './entities/progress-photo.entity';
import { ProgressUpdate } from './entities/progress-update.entity';
import { UpdatesController } from './updates.controller';
import { UpdatesService } from './updates.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProgressUpdate, ProgressPhoto]), ProjectsModule, AiModule],
  controllers: [UpdatesController],
  providers: [UpdatesService],
  exports: [UpdatesService],
})
export class UpdatesModule {}
