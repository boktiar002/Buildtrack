import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { mkdir, rename, rm, stat, writeFile } from 'fs/promises';
import { dirname, resolve, sep } from 'path';
import sharp from 'sharp';
import { loadEnv } from '../../config/env';

// file-type v16 is CommonJS and detects type from the file's magic bytes.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FileType = require('file-type') as { fromBuffer(b: Buffer): Promise<{ ext: string; mime: string } | undefined> };

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

/**
 * Stores files on local disk under STORAGE_DIR and serves them through
 * short-lived signed URLs. Keys are always generated here (never taken from
 * users), and every path is checked to stay inside the storage folder.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly root = resolve(loadEnv().STORAGE_DIR);

  async onModuleInit() {
    await mkdir(this.root, { recursive: true });
    this.logger.log(`File storage: ${this.root}`);
  }

  private pathFor(key: string) {
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) throw new BadRequestException('Invalid file key');
    return full;
  }

  /** Writes atomically: a crash mid-write never leaves a half-written file. */
  async put(key: string, data: Buffer) {
    const full = this.pathFor(key);
    await mkdir(dirname(full), { recursive: true });
    const tmp = `${full}.${randomUUID()}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, full);
  }

  async remove(key: string) {
    try {
      await rm(this.pathFor(key), { force: true });
    } catch (err) {
      this.logger.warn({ err, key }, 'Could not delete file');
    }
  }

  async read(key: string): Promise<Buffer> {
    const { readFile } = await import('fs/promises');
    return readFile(this.pathFor(key));
  }

  async open(key: string) {
    const full = this.pathFor(key);
    if (!existsSync(full)) throw new NotFoundException('File not found');
    const info = await stat(full);
    return { stream: createReadStream(full), size: info.size };
  }

  /** Detects the real type from content; rejects anything not in `allowed`. */
  async detectType(buf: Buffer, allowed: string[]): Promise<{ ext: string; mime: string }> {
    const t = await FileType.fromBuffer(buf);
    if (!t || !allowed.includes(t.mime)) {
      throw new BadRequestException(`Unsupported file type. Allowed: ${allowed.join(', ')}`);
    }
    return t;
  }

  /**
   * Validates and normalises a photo: fixes rotation, resizes to max 1920px,
   * creates a 400px thumbnail, and strips all metadata (including GPS location).
   */
  async savePhoto(buf: Buffer): Promise<{ fileKey: string; thumbKey: string; jpeg: Buffer }> {
    await this.detectType(buf, IMAGE_MIME);
    const id = randomUUID();
    let full: Buffer;
    let thumb: Buffer;
    try {
      const base = sharp(buf, { failOn: 'error', limitInputPixels: 60_000_000 }).rotate();
      full = await base.clone().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      thumb = await base.clone().resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
    } catch {
      throw new BadRequestException('This image could not be read. Please upload a different photo.');
    }
    const fileKey = `photos/${id}.jpg`;
    const thumbKey = `photos/${id}_thumb.jpg`;
    await this.put(fileKey, full);
    await this.put(thumbKey, thumb);
    return { fileKey, thumbKey, jpeg: full };
  }

  async saveDocument(buf: Buffer): Promise<{ fileKey: string; mime: string }> {
    const t = await this.detectType(buf, DOCUMENT_MIME);
    const fileKey = `documents/${randomUUID()}.${t.ext}`;
    await this.put(fileKey, buf);
    return { fileKey, mime: t.mime };
  }

  // ---------------------------------------------------------------- signed URLs

  private sign(key: string, exp: number) {
    return createHmac('sha256', loadEnv().FILE_URL_SECRET).update(`${key}:${exp}`).digest('base64url');
  }

  /** Returns a relative URL valid for `ttlSeconds` (default 5 minutes). */
  signedUrl(key: string | null | undefined, ttlSeconds = 300): string | null {
    if (!key) return null;
    // Round expiry up to the minute so the same URL is reused (better browser caching).
    const exp = Math.ceil((Date.now() / 1000 + ttlSeconds) / 60) * 60;
    return `/api/v1/files/${key}?exp=${exp}&sig=${this.sign(key, exp)}`;
  }

  verify(key: string, exp: string, sig: string) {
    const expNum = Number(exp);
    if (!Number.isFinite(expNum) || expNum * 1000 < Date.now()) throw new NotFoundException('Link expired');
    const expected = Buffer.from(this.sign(key, expNum));
    const given = Buffer.from(sig ?? '');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new NotFoundException('Invalid link');
  }
}
