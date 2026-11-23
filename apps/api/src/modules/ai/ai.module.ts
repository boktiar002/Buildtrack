import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentChunk } from '../documents/entities/document-chunk.entity';
import { FinanceModule } from '../finance/finance.module';
import { Organization } from '../users/entities/organization.entity';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AssistantService } from './assistant.service';
import { DelayRiskService } from './delay-risk.service';
import { DocumentIndexerService } from './document-indexer.service';
import { AiPhotoAnalysis } from './entities/ai-photo-analysis.entity';
import { AiUpdateDraft } from './entities/ai-update-draft.entity';
import { AiUsageLog } from './entities/ai-usage-log.entity';
import { AssistantConversation } from './entities/assistant-conversation.entity';
import { AssistantMessage } from './entities/assistant-message.entity';
import { DelayRiskScore } from './entities/delay-risk-score.entity';
import { PhotoAnalysisService } from './photo-analysis.service';
import { UpdateWriterService } from './update-writer.service';
import { VectorStoreService } from './vector-store.service';

const SERVICES = [
  AiService,
  VectorStoreService,
  PhotoAnalysisService,
  UpdateWriterService,
  AssistantService,
  DelayRiskService,
  DocumentIndexerService,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiUsageLog,
      Organization,
      AiPhotoAnalysis,
      AiUpdateDraft,
      AssistantConversation,
      AssistantMessage,
      DelayRiskScore,
      DocumentChunk,
    ]),
    FinanceModule,
  ],
  controllers: [AiController],
  providers: SERVICES,
  exports: SERVICES,
})
export class AiModule {}
