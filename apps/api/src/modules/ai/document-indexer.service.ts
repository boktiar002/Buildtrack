import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { IndexStatus } from '../../common/enums';
import { withTimeout } from '../../common/utils/retry';
import { DocumentChunk } from '../documents/entities/document-chunk.entity';
import { DocumentEntity } from '../documents/entities/document.entity';
import { StorageService } from '../storage/storage.service';
import { AiService } from './ai.service';

interface PdfJs {
  getDocument(src: Record<string, unknown>): { promise: Promise<PdfDoc> };
}
interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }> }>;
  destroy(): Promise<void>;
}
let pdfjs: PdfJs | null = null;

/** Loads Mozilla pdf.js once. It prints notices about optional drawing support we do not need, so those are muted. */
function loadPdfJs(): PdfJs {
  if (pdfjs) return pdfjs;
  const { log, warn } = console;
  console.log = console.warn = () => undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pdfjs = require('pdfjs-dist/legacy/build/pdf.js') as PdfJs;
  } finally {
    console.log = log;
    console.warn = warn;
  }
  return pdfjs;
}

const MAX_PAGES = 60;

/** Extracts plain text from a PDF (text-based PDFs; scanned images contain no text). */
export async function pdfText(buf: Buffer): Promise<string> {
  const doc = await loadPdfJs().getDocument({
    data: new Uint8Array(buf),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
  try {
    let text = '';
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => (it.str ?? '') + (it.hasEOL ? '\n' : '')).join('') + '\n\n';
    }
    return text;
  } finally {
    await doc.destroy();
  }
}

const CHUNK = 900;
const OVERLAP = 150;
const MAX_TEXT = 120_000;

/** Splits text into overlapping chunks, preferring sentence boundaries. */
export function chunkText(text: string, size = CHUNK, overlap = OVERLAP): string[] {
  const clean = text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + size);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('\n'));
      if (cut > size * 0.5) end = start + cut + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter((c) => c.length > 20);
}

/**
 * Prepares documents for the AI assistant (retrieval-augmented generation):
 * extracts text, splits it into chunks, embeds each chunk and stores the
 * vectors. Runs in the background; failures are recorded on the document
 * and never affect the upload itself.
 */
@Injectable()
export class DocumentIndexerService {
  private readonly logger = new Logger(DocumentIndexerService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly storage: StorageService,
    private readonly ai: AiService,
  ) {}

  indexInBackground(documentId: string) {
    void this.index(documentId).catch((err) => this.logger.error({ err, documentId }, 'Indexing crashed'));
  }

  async index(documentId: string): Promise<IndexStatus> {
    const doc = await this.db.getRepository(DocumentEntity).findOne({ where: { id: documentId } });
    if (!doc) return IndexStatus.FAILED;
    try {
      const buf = await this.storage.read(doc.fileKey);
      let text = '';
      if (doc.mimeType === 'application/pdf') {
        text = await withTimeout(pdfText(buf), 30000, 'PDF reading');
      } else if (this.ai.enabled) {
        const ocr = await this.ai.json(
          { orgId: doc.organizationId, feature: 'document-ocr' },
          {
            system: 'You transcribe documents. Return the readable text exactly as written. Do not summarise or add anything.',
            prompt: 'Transcribe all readable text in this document image.',
            images: [buf],
            shape: '{"text": "the transcribed text"}',
            schema: z.object({ text: z.string().max(20000) }),
            maxOutputTokens: 4000,
          },
          () => ({ text: '' }),
        );
        text = ocr.data.text;
      }
      const chunks = chunkText(`${doc.title}\n\n${text.slice(0, MAX_TEXT)}`);
      if (!chunks.length) chunks.push(doc.title);
      const { vectors, model } = await this.ai.embed({ orgId: doc.organizationId, feature: 'document-index' }, chunks);

      await this.db.transaction(async (em) => {
        await em.getRepository(DocumentChunk).delete({ documentId });
        await em
          .getRepository(DocumentChunk)
          .insert(chunks.map((t, i) => ({ documentId, chunkIndex: i, text: t, embedding: vectors[i], embeddingModel: model })));
        await em.getRepository(DocumentEntity).update(documentId, { indexStatus: IndexStatus.INDEXED, indexError: null });
      });
      return IndexStatus.INDEXED;
    } catch (err) {
      const message = (err as Error).message?.slice(0, 300) ?? 'Unknown error';
      this.logger.warn({ documentId, err: message }, 'Document indexing failed');
      await this.db.getRepository(DocumentEntity).update(documentId, { indexStatus: IndexStatus.FAILED, indexError: message });
      return IndexStatus.FAILED;
    }
  }

  /** Re-indexes documents that failed or were embedded with a different model. */
  async reindexStale(orgId: string) {
    const docs = await this.db
      .getRepository(DocumentEntity)
      .createQueryBuilder('d')
      .where('d.organizationId = :orgId', { orgId })
      .andWhere(
        `(d.indexStatus <> 'INDEXED' OR EXISTS (SELECT 1 FROM document_chunks c WHERE c."documentId" = d.id AND c."embeddingModel" <> :model))`,
        { model: this.ai.embeddingModel },
      )
      .getMany();
    for (const d of docs) await this.index(d.id);
    return { reindexed: docs.length };
  }
}
