import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from '../modules/finance/entities/purchase.entity';
import { ProjectAssignment } from '../modules/projects/entities/project-assignment.entity';
import { Project } from '../modules/projects/entities/project.entity';
import { AccessService } from './services/access.service';

/** Shared, app-wide providers: JWT signing/verification and the data-access permission checks. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectAssignment, Purchase]), JwtModule.register({})],
  providers: [AccessService],
  exports: [AccessService, JwtModule],
})
export class CommonModule {}
