import { createHash } from 'crypto';
import { normalise } from './gemini.provider';

export const LOCAL_EMBEDDING_MODEL = 'local-hash-512';
const DIMS = 512;

const STOP = new Set(
  'a an and are as at be by for from has have i in is it its me my of on or our so that the their them this to was we were what when where which who will with you your'.split(
    ' ',
  ),
);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => t.replace(/(ing|ed|es|s)$/, '').slice(0, 24) || t);
}

function bucket(feature: string): [number, number] {
  const h = createHash('md5').update(feature).digest();
  return [h.readUInt32LE(0) % DIMS, h[4] & 1 ? 1 : -1];
}

/**
 * Offline text embedding using the "hashing trick" over words and word pairs.
 * It captures word overlap (not deep meaning), which is enough for document
 * search when no AI provider is configured, and it never fails.
 */
export function localEmbed(text: string): number[] {
  const v = new Array<number>(DIMS).fill(0);
  const t = tokens(text);
  t.forEach((tok, i) => {
    const [idx, sign] = bucket(`w:${tok}`);
    v[idx] += sign;
    if (i > 0) {
      const [bi, bs] = bucket(`b:${t[i - 1]}_${tok}`);
      v[bi] += 0.5 * bs;
    }
  });
  return normalise(v);
}
