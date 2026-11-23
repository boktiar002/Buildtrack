import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface ChunkHit {
  id: string;
  documentId: string;
  text: string;
  score: number;
}

/**
 * Similarity search over document chunks.
 * Uses PostgreSQL's pgvector extension when it is installed; otherwise it
 * falls back to computing cosine similarity in application code, so search
 * keeps working on machines without pgvector.
 */
@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private pgvector = false;

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async onModuleInit() {
    try {
      await this.db.query('CREATE EXTENSION IF NOT EXISTS vector');
    } catch {
      /* no permission or not installed: checked below */
    }
    try {
      const rows: unknown[] = await this.db.query(`SELECT 1 FROM pg_extension WHERE extname = 'vector'`);
      this.pgvector = rows.length > 0;
    } catch {
      this.pgvector = false;
    }
    this.logger.log(this.pgvector ? 'Vector search: pgvector' : 'Vector search: in-app cosine similarity (pgvector not installed)');
  }

  get usingPgvector() {
    return this.pgvector;
  }

  async search(documentIds: string[], query: number[], model: string, k = 5): Promise<ChunkHit[]> {
    if (!documentIds.length || !query.length) return [];
    if (this.pgvector) {
      try {
        const vec = `[${query.join(',')}]`;
        const rows: Array<{ id: string; documentId: string; text: string; score: string }> = await this.db.query(
          `SELECT id, "documentId", text, 1 - (embedding::vector <=> $1::vector) AS score
             FROM document_chunks
            WHERE "documentId" = ANY($2::uuid[]) AND "embeddingModel" = $3 AND array_length(embedding, 1) = $4
            ORDER BY embedding::vector <=> $1::vector
            LIMIT $5`,
          [vec, documentIds, model, query.length, k],
        );
        return rows.map((r) => ({ ...r, score: Number(r.score) }));
      } catch (err) {
        this.logger.warn({ err: (err as Error).message }, 'pgvector query failed; using in-app search');
      }
    }
    const rows: Array<{ id: string; documentId: string; text: string; embedding: number[] }> = await this.db.query(
      `SELECT id, "documentId", text, embedding FROM document_chunks
        WHERE "documentId" = ANY($1::uuid[]) AND "embeddingModel" = $2 LIMIT 5000`,
      [documentIds, model],
    );
    return rows
      .filter((r) => r.embedding?.length === query.length)
      .map((r) => ({ id: r.id, documentId: r.documentId, text: r.text, score: cosine(query, r.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

export function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
