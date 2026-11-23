import { z } from 'zod';

/**
 * All configuration is read and validated once at startup.
 * If something required is missing or wrong, the API refuses to start and
 * prints exactly which variable is the problem, instead of crashing later.
 */
const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url({ message: 'must be a postgres connection URL' }),
  DB_SSL: bool.default('false'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),

  JWT_ACCESS_SECRET: z.string().min(16, 'must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'must be at least 16 characters'),
  COOKIE_SECURE: bool.default('false'),

  // Developer that self-registered buyers join when they do not name one.
  DEFAULT_ORG_SLUG: z.string().default('pipra'),

  STORAGE_DIR: z.string().default('./storage'),
  FILE_URL_SECRET: z.string().min(16).optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('BuildTrack <no-reply@buildtrack.local>'),
  SMS_PROVIDER: z.enum(['console']).default('console'),

  AI_PROVIDER: z.enum(['gemini', 'mock']).default('mock'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  // How long the newer Gemini models may "think" before answering. Low keeps replies quick. Leave empty for the model default.
  GEMINI_THINKING_LEVEL: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['minimal', 'low', 'medium', 'high']).optional()),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  // Approximate prices in USD per 1 million tokens, used for the monthly budget cap.
  AI_PRICE_INPUT_PER_M: z.coerce.number().min(0).default(0.3),
  AI_PRICE_OUTPUT_PER_M: z.coerce.number().min(0).default(2.5),

  SCHEDULER_ENABLED: bool.default('true'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof schema> & { FILE_URL_SECRET: string };

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    // eslint-disable-next-line no-console
    console.error(
      `\nBuildTrack cannot start: invalid configuration.\n${lines.join('\n')}\n` +
        `Copy apps/api/.env.example to apps/api/.env and fill in the values.\n`,
    );
    throw new Error('Invalid environment configuration');
  }
  const env = parsed.data;
  if (env.AI_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) {
    // Not fatal: the AI module falls back to the offline mock provider.
    // eslint-disable-next-line no-console
    console.warn('AI_PROVIDER=gemini but GEMINI_API_KEY is empty: using the offline mock AI provider.');
  }
  cached = { ...env, FILE_URL_SECRET: env.FILE_URL_SECRET ?? env.JWT_ACCESS_SECRET };
  return cached;
}

/** Only for tests. */
export function resetEnvCache() {
  cached = null;
}
