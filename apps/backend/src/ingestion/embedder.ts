/**
 * apps/backend/src/ingestion/embedder.ts
 *
 * Embeds tagged chunks and upserts them into Pinecone.
 *
 * Vector ID format: {userId}_{fileName}_{chunkIndex}
 * Metadata stored alongside each vector:
 *   userId, fileName, chunkIndex, conceptTags, text (truncated), subject, page?
 *
 * Batching:
 *   Embedding: 32 texts per call  (OpenAI limit)
 *   Pinecone upsert: 100 vectors per call (Pinecone recommendation)
 *
 * The text stored in metadata is truncated to 1000 chars — Pinecone metadata
 * has a 40KB per-vector limit and we store other fields too.
 */

import { Pinecone } from "@pinecone-database/pinecone";
import type { EmbeddingProvider } from "../providers/base.js";
import type { TaggedChunk } from "./conceptTagger.js";
import { env } from "../config.js";

const EMBED_BATCH_SIZE = 32;
const UPSERT_BATCH_SIZE = 100;
const METADATA_TEXT_LIMIT = 1000;

// ── Pinecone singleton ────────────────────────────────────────────────────────

let pineconeClient: Pinecone | null = null;

function getPinecone(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  }
  return pineconeClient;
}

export function getPineconeIndex() {
  return getPinecone().index(env.PINECONE_INDEX_NAME);
}

// ── Vector metadata shape ─────────────────────────────────────────────────────

export interface ChunkMetadata {
  userId: string;
  fileName: string;
  chunkIndex: number;
  conceptTags: string[];
  text: string;          // truncated for metadata size limit
  subject: string;
  page?: number;
  // Index signature required by Pinecone RecordMetadata
  [key: string]: string | number | boolean | string[] | undefined;
}

// ── Vector ID builder ─────────────────────────────────────────────────────────

/**
 * Generates a deterministic, unique vector ID for a chunk.
 * Sanitises the fileName to remove characters invalid in Pinecone IDs.
 */
export function buildVectorId(
  userId: string,
  fileName: string,
  chunkIndex: number
): string {
  const safeFileName = fileName
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60);
  return `${userId}_${safeFileName}_${chunkIndex}`;
}

// ── Main embedder ─────────────────────────────────────────────────────────────

export interface EmbedAndUpsertResult {
  vectorCount: number;
  failedChunks: number;
}

/**
 * Embeds all tagged chunks and upserts them into Pinecone.
 *
 * @param chunks    Tagged chunks from conceptTagger
 * @param userId    GitHub user ID (used for namespace + metadata)
 * @param fileName  Original filename (used in vector ID + metadata)
 * @param subject   Inferred subject for this file
 * @param embedder  Embedding provider instance
 * @param onProgress  Called after each batch with (completed, total)
 */
export async function embedAndUpsert(
  chunks: TaggedChunk[],
  userId: string,
  fileName: string,
  subject: string,
  embedder: EmbeddingProvider,
  onProgress?: (completed: number, total: number) => void
): Promise<EmbedAndUpsertResult> {
  if (chunks.length === 0) return { vectorCount: 0, failedChunks: 0 };

  const index = getPineconeIndex();
  const ns = index.namespace(userId);

  let vectorCount = 0;
  let failedChunks = 0;

  // ── Step 1: Embed in batches of 32 ─────────────────────────────────────────
  const allEmbeddings: (number[] | null)[] = new Array(chunks.length).fill(null);

  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const texts = batch.map((c) => c.text);

    try {
      const embeddings = await embedder.embed(texts);
      for (let j = 0; j < batch.length; j++) {
        allEmbeddings[i + j] = embeddings[j] ?? null;
      }
    } catch (err) {
      console.error(
        `[embedder] Embed batch ${i}–${i + batch.length - 1} failed:`,
        err instanceof Error ? err.message : err
      );
      failedChunks += batch.length;
    }
  }

  // ── Step 2: Build Pinecone vector objects ───────────────────────────────────
  const vectors: Array<{
    id: string;
    values: number[];
    metadata: ChunkMetadata;
  }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = allEmbeddings[i];
    if (!embedding) continue; // skip failed embeds

    const chunk = chunks[i]!;
    vectors.push({
      id: buildVectorId(userId, fileName, chunk.index),
      values: embedding,
      metadata: {
        userId,
        fileName,
        chunkIndex: chunk.index,
        conceptTags: chunk.conceptTags,
        text: chunk.text.slice(0, METADATA_TEXT_LIMIT),
        subject,
        ...(chunk.page !== undefined ? { page: chunk.page } : {}),
      },
    });
  }

  // ── Step 3: Upsert to Pinecone in batches of 100 ───────────────────────────
  for (let i = 0; i < vectors.length; i += UPSERT_BATCH_SIZE) {
    const batch = vectors.slice(i, i + UPSERT_BATCH_SIZE);

    try {
      await ns.upsert(batch as any);
      vectorCount += batch.length;
      onProgress?.(i + batch.length, vectors.length);
    } catch (err) {
      console.error(
        `[embedder] Pinecone upsert batch ${i}–${i + batch.length - 1} failed:`,
        err instanceof Error ? err.message : err
      );
      failedChunks += batch.length;
    }
  }

  return { vectorCount, failedChunks };
}

// ── Delete vectors for a file ──────────────────────────────────────────────────

/**
 * Deletes all Pinecone vectors for a specific file belonging to a user.
 * Called by DELETE /upload/:fileName.
 */
export async function deleteFileVectors(
  userId: string,
  fileName: string,
  chunkCount: number
): Promise<void> {
  const index = getPineconeIndex();
  const ns = index.namespace(userId);

  // Build all expected vector IDs for this file
  const ids = Array.from({ length: chunkCount }, (_, i) =>
    buildVectorId(userId, fileName, i)
  );

  // Delete in batches of 100
  for (let i = 0; i < ids.length; i += UPSERT_BATCH_SIZE) {
    const batch = ids.slice(i, i + UPSERT_BATCH_SIZE);
    await ns.deleteMany(batch);
  }
}

// ── Pinecone connectivity check ───────────────────────────────────────────────

/** Returns true if Pinecone index is reachable. Used by /health. */
export async function pingPinecone(): Promise<boolean> {
  try {
    const index = getPineconeIndex();
    await index.describeIndexStats();
    return true;
  } catch {
    return false;
  }
}
