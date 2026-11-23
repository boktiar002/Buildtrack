import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Minimal .env loader (no extra dependency). Existing environment variables
 * always win, so production platforms can inject real values.
 */
// apps/api/.env, found from src/database (ts-node) or dist/src/database (built), or the working directory.
const CANDIDATES = [resolve(__dirname, '../../.env'), resolve(__dirname, '../../../.env'), resolve(process.cwd(), '.env')];

export function config(file = CANDIDATES.find((f) => existsSync(f))): void {
  if (!file || !existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
