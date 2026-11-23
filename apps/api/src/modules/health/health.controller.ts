import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { withTimeout } from '../../common/utils/retry';
import { AiService } from '../ai/ai.service';
import { VectorStoreService } from '../ai/vector-store.service';

/** Used by uptime monitors and the deployment platform. Never exposes secrets. */
@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly ai: AiService,
    private readonly vectors: VectorStoreService,
  ) {}

  @ApiOperation({ summary: 'Health check: database, AI mode and vector search' })
  @Get()
  async check() {
    let database = 'up';
    try {
      await withTimeout(this.db.query('SELECT 1'), 3000, 'Database check');
    } catch {
      database = 'down';
    }
    const body = {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      ai: this.ai.enabled ? 'gemini' : 'offline',
      vectorSearch: this.vectors.usingPgvector ? 'pgvector' : 'in-app',
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    };
    if (database !== 'up') throw new ServiceUnavailableException(body);
    return body;
  }
}
