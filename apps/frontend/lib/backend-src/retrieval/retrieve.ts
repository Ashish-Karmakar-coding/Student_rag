/**
 * apps/backend/src/retrieval/retrieve.ts
 *
 * Single entry point for the full retrieval pipeline.
 * Called by the LangGraph "retrieve" node.
 *
 * Orchestrates:
 *   1. hybridSearch   — dense + sparse + RRF
 *   2. applyMasteryBoost — re-weights toward weak concepts
 *   3. rerank         — optional Cohere cross-encoder
 */

import { hybridSearch } from "./hybrid";
import { applyMasteryBoost, buildMasteryContext } from "./masteryWeighter";
import { rerank } from "./reranker";
import type { EmbeddingProvider } from "../providers/base";
import type { RetrievedChunk } from "./hybrid";

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  masteryContext: Record<string, number>;
}

/**
 * Runs the complete retrieval pipeline for a user query.
 *
 * @param query    The user's question
 * @param userId   GitHub user ID (namespace + filter)
 * @param embedder Embedding provider for query vectorisation
 */
export async function retrieve(
  query: string,
  userId: string,
  embedder: EmbeddingProvider,
  fileName?: string
): Promise<RetrievalResult> {
  // 1. Hybrid search: dense + BM25 + RRF → top 6
  const candidates = await hybridSearch(query, userId, embedder, fileName);

  if (candidates.length === 0) {
    return { chunks: [], masteryContext: {} };
  }

  // 2. Mastery boost: re-weight and re-sort
  const boosted = await applyMasteryBoost(candidates, userId);

  // 3. Build mastery context map (for LangGraph state + prompt)
  const masteryContext = await buildMasteryContext(boosted, userId);

  // 4. Optional Cohere rerank
  const final = await rerank(query, boosted);

  return { chunks: final, masteryContext };
}
