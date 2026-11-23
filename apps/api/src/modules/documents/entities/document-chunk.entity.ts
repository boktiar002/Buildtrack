import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DocumentEntity } from './document.entity';

@Entity('document_chunks')
@Index(['documentId'])
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') documentId: string;
  @ManyToOne(() => DocumentEntity, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'documentId' }) document: Relation<DocumentEntity>;
  @Column('int') chunkIndex: number;
  @Column('text') text: string;
  /** double precision[]; cast to pgvector `vector` at query time when available. */
  @Column({ type: 'double precision', array: true }) embedding: number[];
  /** Which embedding model produced the vector (vectors from different models are not comparable). */
  @Column() embeddingModel: string;
}
