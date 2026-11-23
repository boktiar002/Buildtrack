import type { ZodType, ZodTypeDef } from 'zod';

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface JsonRequest<T> {
  /** Fixed instructions written by us (never user text). */
  system: string;
  /** The task, with any user or document text clearly wrapped as data. */
  prompt: string;
  images?: Buffer[];
  /** Output type T (after defaults); the raw input may be looser. */
  schema: ZodType<T, ZodTypeDef, unknown>;
  /** Short JSON description of the expected output, included in the prompt. */
  shape: string;
  maxOutputTokens?: number;
}

export interface AiProvider {
  readonly name: 'gemini' | 'mock';
  readonly model: string;
  readonly embeddingModel: string;
  generateJson<T>(req: JsonRequest<T>, signal: AbortSignal): Promise<{ data: T; usage: AiUsage }>;
  embed(texts: string[], signal: AbortSignal): Promise<{ vectors: number[][]; usage: AiUsage }>;
}

/** Thrown for errors that will not get better by retrying (bad key, bad request). */
export class AiPermanentError extends Error {}

/** Thrown when Gemini is still silent after the time limit. Retrying would only make the user wait longer. */
export class AiTimeoutError extends Error {}

/** Thrown when the monthly AI budget has been used up. */
export class AiBudgetError extends Error {}
