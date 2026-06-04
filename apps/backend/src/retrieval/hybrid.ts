/**
 * apps/backend/src/retrieval/hybrid.ts
 *
 * Hybrid retrieval: Dense (Pinecone) + Sparse (BM25) fused via
 * Reciprocal Rank Fusion (RRF), then re-weighted by mastery scores.
 *
 * Pipeline:
 *   1. Dense retrieval  — Pinecone top-40
 *   2. BM25 sparse      — built on-the-fly over the 40 candidates (~1ms)
 *   3. RRF fusion       — combines both ranked lists
 *   4. Mastery boost    — boosts chunks whose concepts the user struggles with
 *   5. Cohere rerank    — optional, falls back to mastery-weighted order
 *   → Returns top 6 candidates
 */

import { getPineconeIndex } from "../ingestion/embedder.js";
import type { EmbeddingProvider } from "../providers/base.js";
import type { ChunkMetadata } from "../ingestion/embedder.js";

// Wink packages use CommonJS — import with createRequire for ESM compatibility
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
const BM25 = require("wink-bm25-text-search") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
const winkNLP = require("wink-nlp") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
const model = require("wink-eng-lite-web-model") as any;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RetrievedChunk {
  id: string;
  metadata: ChunkMetadata;
  /** Final ranked score after RRF + mastery boost */
  finalScore: number;
  /** Raw dense similarity score from Pinecone */
  denseScore: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DENSE_TOP_K = 40;      // Pinecone retrieval size
const FINAL_TOP_K = 6;       // returned to LangGraph
const RRF_K = 60;            // RRF constant (standard value)

// ── Initialise winkNLP once at module level ───────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const nlp = winkNLP(model);
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
const its = nlp.its;

// ── Dense retrieval ───────────────────────────────────────────────────────────

interface PineconeMatch {
  id: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

async function denseRetrieve(
  query: string,
  userId: string,
  embedder: EmbeddingProvider,
  fileName?: string
): Promise<PineconeMatch[]> {
  const [queryVector] = await embedder.embed([query]);
  if (!queryVector) throw new Error("Failed to embed query");

  const index = getPineconeIndex();
  const ns = index.namespace(userId);

  const filter: Record<string, any> = { userId: { $eq: userId } };
  if (fileName) {
    filter.fileName = { $eq: fileName };
  }

  const result = await ns.query({
    vector: queryVector,
    topK: DENSE_TOP_K,
    includeMetadata: true,
    filter,
  });

  return result.matches ?? [];
}

// ── BM25 sparse retrieval (built over dense candidates) ───────────────────────

function buildSparseRanks(
  query: string,
  candidates: PineconeMatch[]
): Map<number, number> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const engine = BM25();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  engine.defineConfig({ fldWeights: { text: 1 } });
  // Custom prep task to tokenize and lemmatize using wink-nlp
  const prepTask = (text: string) => {
    const tokens: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    nlp.readDoc(text)
      .tokens()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((t: any) => t.out(its.type) === "word" && !t.out(its.stopWordFlag))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .each((t: any) => tokens.push(t.out(its.lemma) || t.out()));
    return tokens;
  };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  engine.definePrepTasks([prepTask]);

  candidates.forEach((match, idx) => {
    const text = (match.metadata?.["text"] as string | undefined) ?? "";
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    engine.addDoc({ text }, idx);
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  engine.consolidate();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const results = engine.search(query) as Array<[number, number]>;

  // Map: candidate index → BM25 rank position (0-based)
  const rankMap = new Map<number, number>();
  results.forEach(([docIdx], rank) => {
    rankMap.set(docIdx, rank);
  });

  return rankMap;
}

// ── Reciprocal Rank Fusion ────────────────────────────────────────────────────

function applyRRF(
  candidates: PineconeMatch[],
  sparseRanks: Map<number, number>
): Array<PineconeMatch & { rrfScore: number }> {
  return candidates
    .map((match, denseRank) => {
      const sparseRank = sparseRanks.get(denseRank) ?? candidates.length;
      const rrfScore =
        1 / (RRF_K + denseRank + 1) + 1 / (RRF_K + sparseRank + 1);
      return { ...match, rrfScore };
    })
    .sort((a, b) => b.rrfScore - a.rrfScore);
}

// ── Public hybrid search ──────────────────────────────────────────────────────

/**
 * Runs the full hybrid search pipeline.
 * Returns top FINAL_TOP_K candidates sorted by rrfScore.
 * Mastery boosting is applied in masteryWeighter.ts (separate concern).
 *
 * @param query    The user's query string
 * @param userId   GitHub user ID (used for Pinecone namespace + filter)
 * @param embedder Embedding provider for query vectorisation
 */
export async function hybridSearch(
  query: string,
  userId: string,
  embedder: EmbeddingProvider,
  fileName?: string
): Promise<RetrievedChunk[]> {
  // 1. Dense retrieval
  const denseMatches = await denseRetrieve(query, userId, embedder, fileName);

  if (denseMatches.length === 0) {
    return [];
  }

  // If too few candidates for BM25 consolidation, just return dense ranking
  if (denseMatches.length < 3) {
    return denseMatches.slice(0, FINAL_TOP_K).map((match) => ({
      id: match.id,
      metadata: match.metadata as ChunkMetadata,
      finalScore: match.score ?? 0,
      denseScore: match.score ?? 0,
    }));
  }

  // 2. BM25 sparse ranks over the 40 dense candidates
  const sparseRanks = buildSparseRanks(query, denseMatches);

  // 3. RRF fusion
  const fused = applyRRF(denseMatches, sparseRanks);

  // 4. Map to RetrievedChunk (mastery boost applied separately)
  return fused.slice(0, FINAL_TOP_K).map((match) => ({
    id: match.id,
    metadata: match.metadata as ChunkMetadata,
    finalScore: match.rrfScore,
    denseScore: match.score ?? 0,
  }));
}

export { FINAL_TOP_K };
