import { AiPermanentError, AiProvider, AiUsage, JsonRequest } from '../ai.types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const EMBEDDING_DIMENSIONS = 768;

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/**
 * Google Gemini API over plain HTTPS (no SDK, so nothing extra can break).
 * Network errors, 429 and 5xx are retryable; 4xx errors are permanent.
 */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini' as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    readonly embeddingModel: string,
    private readonly thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high',
  ) {}

  private async post<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
    const res = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      const msg = `Gemini HTTP ${res.status}: ${detail}`;
      if (res.status === 429 || res.status >= 500) throw new Error(msg);
      throw new AiPermanentError(msg);
    }
    return (await res.json()) as T;
  }

  async generateJson<T>(req: JsonRequest<T>, signal: AbortSignal): Promise<{ data: T; usage: AiUsage }> {
    const parts: Array<Record<string, unknown>> = [{ text: `${req.prompt}\n\nReply with JSON only, in this shape:\n${req.shape}` }];
    for (const img of req.images ?? []) parts.push({ inlineData: { mimeType: 'image/jpeg', data: img.toString('base64') } });

    const json = await this.post<GeminiResponse>(
      `models/${encodeURIComponent(this.model)}:generateContent`,
      {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: req.maxOutputTokens ?? 1024,
          // Newer models think before answering, which is slow. A low level keeps replies quick.
          ...(this.thinkingLevel && { thinkingConfig: { thinkingLevel: this.thinkingLevel } }),
        },
      },
      signal,
    );
    if (json.promptFeedback?.blockReason) throw new AiPermanentError(`Blocked by safety filter: ${json.promptFeedback.blockReason}`);
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error('Gemini returned an empty answer');

    let parsed: unknown;
    try {
      parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch {
      throw new Error('Gemini returned text that is not valid JSON');
    }
    const result = req.schema.safeParse(parsed);
    if (!result.success) throw new Error(`Gemini JSON did not match the expected format: ${result.error.issues[0]?.message}`);
    return {
      data: result.data,
      usage: { inputTokens: json.usageMetadata?.promptTokenCount ?? 0, outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0 },
    };
  }

  async embed(texts: string[], signal: AbortSignal): Promise<{ vectors: number[][]; usage: AiUsage }> {
    const json = await this.post<{ embeddings?: Array<{ values: number[] }> }>(
      `models/${encodeURIComponent(this.embeddingModel)}:batchEmbedContents`,
      {
        requests: texts.map((text) => ({
          model: `models/${this.embeddingModel}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      },
      signal,
    );
    const vectors = json.embeddings?.map((e) => normalise(e.values)) ?? [];
    if (vectors.length !== texts.length) throw new Error('Gemini returned the wrong number of embeddings');
    const approxTokens = Math.ceil(texts.join(' ').length / 4);
    return { vectors, usage: { inputTokens: approxTokens, outputTokens: 0 } };
  }
}

export function normalise(v: number[]): number[] {
  const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / len);
}
