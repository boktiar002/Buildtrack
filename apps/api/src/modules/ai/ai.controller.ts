import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AiService } from './ai.service';
import { AssistantService } from './assistant.service';
import { DelayRiskService } from './delay-risk.service';
import { DocumentIndexerService } from './document-indexer.service';
import { AskQuestionDto } from './dto/ask-question.dto';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { RateAnswerDto } from './dto/rate-answer.dto';
import { VectorStoreService } from './vector-store.service';

@ApiTags('ai')
@Controller()
export class AiController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly risk: DelayRiskService,
    private readonly ai: AiService,
    private readonly indexer: DocumentIndexerService,
    private readonly vectors: VectorStoreService,
  ) {}

  @ApiOperation({ summary: "Ask the AI assistant a question about one of the buyer's flats" })
  @Roles(Role.BUYER)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('assistant/ask')
  @HttpCode(200)
  ask(@CurrentUser() u: AuthUser, @Body() dto: AskQuestionDto) {
    return this.assistant.ask(u, dto.purchaseId, dto.question, dto.conversationId);
  }

  @ApiOperation({ summary: "List the buyer's past assistant conversations" })
  @Roles(Role.BUYER)
  @Get('assistant/conversations')
  conversations(@CurrentUser() u: AuthUser, @Query() q: ConversationQueryDto) {
    return this.assistant.conversations(u, q.purchaseId);
  }

  @ApiOperation({ summary: 'Rate an assistant answer as helpful or not' })
  @Roles(Role.BUYER)
  @Post('assistant/messages/:id/rate')
  @HttpCode(204)
  rate(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RateAnswerDto) {
    return this.assistant.rate(u, id, dto.helpful);
  }

  @ApiOperation({ summary: 'Send an assistant conversation to the support team as a ticket' })
  @Roles(Role.BUYER)
  @Post('assistant/conversations/:id/escalate')
  escalate(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assistant.escalate(u, id);
  }

  @ApiOperation({ summary: 'Latest delay-risk score with its reasons and AI explanation' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Get('projects/:id/risk')
  getRisk(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.risk.forProject(u, id);
  }

  @ApiOperation({ summary: 'Recalculate the delay-risk score now' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('projects/:id/risk/recompute')
  @HttpCode(200)
  recompute(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.risk.recompute(u, id);
  }

  @ApiOperation({ summary: "Which AI provider is active, and this month's AI usage and spend" })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Get('ai/status')
  async status(@CurrentUser() u: AuthUser) {
    return { ...(await this.ai.usageSummary(u.orgId)), vectorSearch: this.vectors.usingPgvector ? 'pgvector' : 'in-app' };
  }

  @ApiOperation({ summary: 'Re-read and re-index every document for the assistant' })
  @Roles(Role.ORG_ADMIN)
  @Post('ai/reindex')
  @HttpCode(200)
  reindex(@CurrentUser() u: AuthUser) {
    return this.indexer.reindexStale(u.orgId);
  }
}
