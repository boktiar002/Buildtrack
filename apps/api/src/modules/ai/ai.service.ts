import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { withRetry } from '../../common/utils/retry';
import { loadEnv } from '../../config/env';
import { Organization } from '../users/entities/organization.entity';
import { AiBudgetError, AiPermanentError, AiProvider, AiTimeoutError, AiUsage, JsonRequest } from './ai.types';
import { AiUsageLog } from './entities/ai-usage-log.entity';
import { GeminiProvider } from './providers/gemini.provider';
import { LOCAL_EMBEDDING_MODEL, localEmbed } from './providers/local-embedder';

export type AiSource = 'ai' | 'fallback' | 'offline';

export interface AiResult<T> {
  data: T;
  /** ai = real model answer; fallback = model failed so built-in logic answered; offline = no model configured. */
  source: AiSource;
  model: string;
  error?: string;
}

interface CallContext {
  orgId: string;
  userId?: string | null;
  feature: string;
}

/** Limits how many AI requests run at once, so a burst cannot overload the server. */
class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;
  constructor(private readonly max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((r) => this.queue.push(r));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

/**
 * The AI gateway. Every AI call in BuildTrack goes through here, which gives:
 *  - one place to switch provider (Gemini, or offline mode with no key)
 *  - a timeout and automatic retries for temporary failures
 *  - validation of every JSON answer against a schema
 *  - a monthly spending cap per organization
 *  - a usage log for cost tracking and evaluation
 *  - a safe fallback: callers always get an answer, never an exception
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly provider: AiProvider | null;
  private readonly limiter = new Semaphore(4);

  constructor(
    @InjectRepository(AiUsageLog) private readonly usage: Repository<AiUsageLog>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
  ) {
    const env = loadEnv();
    this.provider =
      env.AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY
        ? new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL, env.GEMINI_EMBEDDING_MODEL, env.GEMINI_THINKING_LEVEL)
        : null;
    this.logger.log(this.provider ? `AI provider: Gemini (${env.GEMINI_MODEL})` : 'AI provider: offline mode (no API key configured)');
  }

  get enabled() {
    return this.provider !== null;
  }

  get modelName() {
    return this.provider?.model ?? 'offline';
  }

  get embeddingModel() {
    return this.provider?.embeddingModel ?? LOCAL_EMBEDDING_MODEL;
  }

  /** Asks the model for JSON. On any failure, returns `fallback()` instead of throwing. */
  async json<T>(ctx: CallContext, req: JsonRequest<T>, fallback: () => T | Promise<T>): Promise<AiResult<T>> {
    if (!this.provider) return { data: await fallback(), source: 'offline', model: 'offline' };
    try {
      await this.checkBudget(ctx.orgId);
      const { data, usage, latency } = await this.call(ctx, (signal) => this.provider!.generateJson(req, signal));
      await this.log(ctx, usage, latency, true);
      return { data, source: 'ai', model: this.provider.model };
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      if (!(err instanceof AiBudgetError)) await this.log(ctx, { inputTokens: 0, outputTokens: 0 }, 0, false, message);
      this.logger.warn({ feature: ctx.feature, err: message }, 'AI call failed; using fallback');
      return { data: await fallback(), source: 'fallback', model: this.provider.model, error: friendly(err) };
    }
  }

  /**
   * Embeds texts. With a provider configured this uses its embedding model;
   * if that fails, the caller is told so it can retry later (vectors from
   * different models must not be mixed).
   */
  async embed(ctx: CallContext, texts: string[]): Promise<{ vectors: number[][]; model: string }> {
    if (!this.provider) return { vectors: texts.map(localEmbed), model: LOCAL_EMBEDDING_MODEL };
    await this.checkBudget(ctx.orgId);
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += 50) {
      const batch = texts.slice(i, i + 50);
      const { data, usage, latency } = await this.call({ ...ctx, feature: `${ctx.feature}:embed` }, (signal) =>
        this.provider!.embed(batch, signal).then((r) => ({ data: r.vectors, usage: r.usage })),
      );
      await this.log({ ...ctx, feature: `${ctx.feature}:embed` }, usage, latency, true);
      vectors.push(...data);
    }
    return { vectors, model: this.provider.embeddingModel };
  }

  private async call<T>(ctx: CallContext, fn: (signal: AbortSignal) => Promise<{ data: T; usage: AiUsage }>) {
    const env = loadEnv();
    const started = Date.now();
    const result = await this.limiter.run(() =>
      withRetry(
        async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
          try {
            return await fn(controller.signal);
          } catch (err) {
            if (controller.signal.aborted) throw new AiTimeoutError(`AI request timed out after ${env.AI_TIMEOUT_MS} ms`);
            throw err;
          } finally {
            clearTimeout(timer);
          }
        },
        { retries: env.AI_MAX_RETRIES, baseMs: 800, isRetryable: (e) => !(e instanceof AiPermanentError || e instanceof AiTimeoutError) },
      ),
    );
    return { ...result, latency: Date.now() - started };
  }

  async monthSpend(orgId: string): Promise<number> {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const row = await this.usage
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.costUsd), 0)', 'total')
      .where('l.organizationId = :orgId AND l.createdAt >= :start', { orgId, start })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async checkBudget(orgId: string) {
    const org = await this.orgs.findOne({ where: { id: orgId }, select: { id: true, aiMonthlyBudgetUsd: true } });
    const budget = Number(org?.aiMonthlyBudgetUsd ?? 0);
    if ((await this.monthSpend(orgId)) >= budget) throw new AiBudgetError('Monthly AI budget reached');
  }

  private async log(ctx: CallContext, usage: AiUsage, latencyMs: number, success: boolean, error?: string) {
    const env = loadEnv();
    const cost = (usage.inputTokens * env.AI_PRICE_INPUT_PER_M + usage.outputTokens * env.AI_PRICE_OUTPUT_PER_M) / 1_000_000;
    try {
      await this.usage.insert({
        organizationId: ctx.orgId,
        userId: ctx.userId ?? null,
        feature: ctx.feature,
        model: this.modelName,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: cost.toFixed(6),
        latencyMs,
        success,
        error: error?.slice(0, 500) ?? null,
      });
    } catch (err) {
      this.logger.error({ err }, 'Could not write AI usage log');
    }
  }

  async usageSummary(orgId: string) {
    const org = await this.orgs.findOneByOrFail({ id: orgId });
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const byFeature = await this.usage
      .createQueryBuilder('l')
      .select('l.feature', 'feature')
      .addSelect('COUNT(*)::int', 'calls')
      .addSelect('SUM(CASE WHEN l.success THEN 1 ELSE 0 END)::int', 'succeeded')
      .addSelect('COALESCE(SUM(l.costUsd),0)', 'costUsd')
      .addSelect('COALESCE(AVG(l.latencyMs),0)::int', 'avgLatencyMs')
      .where('l.organizationId = :orgId AND l.createdAt >= :start', { orgId, start })
      .groupBy('l.feature')
      .getRawMany();
    return {
      provider: this.provider ? 'gemini' : 'offline',
      model: this.modelName,
      embeddingModel: this.embeddingModel,
      monthlyBudgetUsd: Number(org.aiMonthlyBudgetUsd),
      spentThisMonthUsd: await this.monthSpend(orgId),
      byFeature,
    };
  }
}

function friendly(err: unknown): string {
  if (err instanceof AiBudgetError) return 'The monthly AI budget has been reached.';
  const m = (err as Error)?.message ?? '';
  if (m.includes('timed out')) return 'The AI service took too long to answer.';
  if (m.includes('429')) return 'The AI service is busy right now.';
  if (err instanceof AiPermanentError) return 'The AI service rejected the request.';
  return 'The AI service is temporarily unavailable.';
}
