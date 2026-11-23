import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { resetEnvCache } from '../src/config/env';
import { AiService } from '../src/modules/ai/ai.service';
import { AiPermanentError, AiProvider } from '../src/modules/ai/ai.types';
import { GeminiProvider } from '../src/modules/ai/providers/gemini.provider';

/** Builds an AiService with in-memory stand-ins for the database. */
function makeService(provider: AiProvider, spentUsd = 0) {
  resetEnvCache();
  process.env.AI_TIMEOUT_MS = '300';
  process.env.AI_MAX_RETRIES = '1';
  const logs: Array<{ success: boolean }> = [];
  const usageRepo = {
    insert: async (row: { success: boolean }) => logs.push(row),
    createQueryBuilder: () => {
      const qb = { select: () => qb, where: () => qb, getRawOne: async () => ({ total: String(spentUsd) }) };
      return qb;
    },
  };
  const orgRepo = { findOne: async () => ({ id: 'org', aiMonthlyBudgetUsd: '5.00' }) };
  const svc = new AiService(usageRepo as never, orgRepo as never);
  (svc as unknown as { provider: AiProvider }).provider = provider;
  return { svc, logs };
}

const req = { system: 's', prompt: 'p', shape: '{"ok": boolean}', schema: z.object({ ok: z.boolean() }) };
const ctx = { orgId: 'org', feature: 'test' };
const fallback = () => ({ ok: false });

function provider(generate: AiProvider['generateJson']): AiProvider {
  return {
    name: 'gemini',
    model: 'test-model',
    embeddingModel: 'test-embed',
    generateJson: generate,
    embed: async () => ({ vectors: [], usage: { inputTokens: 0, outputTokens: 0 } }),
  };
}

beforeAll(() => Logger.overrideLogger(false)); // expected failures are logged as warnings

afterAll(() => {
  delete process.env.AI_TIMEOUT_MS;
  delete process.env.AI_MAX_RETRIES;
  resetEnvCache();
});

describe('AI gateway never breaks the app', () => {
  it('returns the real answer when the provider works', async () => {
    const { svc, logs } = makeService(provider(async () => ({ data: { ok: true } as never, usage: { inputTokens: 10, outputTokens: 5 } })));
    const r = await svc.json(ctx, req, fallback);
    expect(r).toMatchObject({ source: 'ai', data: { ok: true } });
    expect(logs[0].success).toBe(true);
  });

  it('retries a temporary failure, then succeeds', async () => {
    let calls = 0;
    const { svc } = makeService(
      provider(async () => {
        if (++calls === 1) throw new Error('Gemini HTTP 503');
        return { data: { ok: true } as never, usage: { inputTokens: 1, outputTokens: 1 } };
      }),
    );
    expect((await svc.json(ctx, req, fallback)).source).toBe('ai');
    expect(calls).toBe(2);
  });

  it('falls back when the provider keeps failing', async () => {
    const { svc, logs } = makeService(
      provider(async () => {
        throw new Error('network down');
      }),
    );
    const r = await svc.json(ctx, req, fallback);
    expect(r).toMatchObject({ source: 'fallback', data: { ok: false } });
    expect(r.error).toBe('The AI service is temporarily unavailable.');
    expect(logs.at(-1)?.success).toBe(false);
  });

  it('does not retry permanent errors such as a bad API key', async () => {
    let calls = 0;
    const { svc } = makeService(
      provider(async () => {
        calls++;
        throw new AiPermanentError('Gemini HTTP 403');
      }),
    );
    expect((await svc.json(ctx, req, fallback)).source).toBe('fallback');
    expect(calls).toBe(1);
  });

  it('times out a provider that hangs', async () => {
    const { svc } = makeService(
      provider((_r, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))),
    );
    const started = Date.now();
    const r = await svc.json(ctx, req, fallback);
    expect(r.source).toBe('fallback');
    expect(r.error).toContain('too long');
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('stops calling the AI when the monthly budget is used up', async () => {
    let calls = 0;
    const { svc } = makeService(
      provider(async () => {
        calls++;
        return { data: { ok: true } as never, usage: { inputTokens: 1, outputTokens: 1 } };
      }),
      5,
    );
    const r = await svc.json(ctx, req, fallback);
    expect(r).toMatchObject({ source: 'fallback', error: 'The monthly AI budget has been reached.' });
    expect(calls).toBe(0);
  });
});

describe('Gemini provider validates every answer', () => {
  const realFetch = global.fetch;
  afterEach(() => (global.fetch = realFetch));
  const reply = (status: number, body: unknown) =>
    (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as typeof fetch;
  const gemini = new GeminiProvider('key', 'model', 'embed');
  const signal = new AbortController().signal;

  it('parses a valid JSON answer', async () => {
    global.fetch = reply(200, {
      candidates: [{ content: { parts: [{ text: '{"ok": true}' }] } }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
    });
    await expect(gemini.generateJson(req, signal)).resolves.toMatchObject({
      data: { ok: true },
      usage: { inputTokens: 3, outputTokens: 2 },
    });
  });
  it('rejects text that is not JSON', async () => {
    global.fetch = reply(200, { candidates: [{ content: { parts: [{ text: 'Sure! Here you go' }] } }] });
    await expect(gemini.generateJson(req, signal)).rejects.toThrow('not valid JSON');
  });
  it('rejects JSON in the wrong shape', async () => {
    global.fetch = reply(200, { candidates: [{ content: { parts: [{ text: '{"ok": "yes"}' }] } }] });
    await expect(gemini.generateJson(req, signal)).rejects.toThrow('expected format');
  });
  it('treats 400/403 as permanent and 429/500 as temporary', async () => {
    global.fetch = reply(403, 'forbidden');
    await expect(gemini.generateJson(req, signal)).rejects.toBeInstanceOf(AiPermanentError);
    global.fetch = reply(429, 'busy');
    await expect(gemini.generateJson(req, signal)).rejects.not.toBeInstanceOf(AiPermanentError);
  });
});
