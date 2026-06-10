/**
 * apps/backend/src/retrieval/reranker.ts
 *
 * Optional Cohere reranking applied after mastery-weighted RRF.
 *
 * If COHERE_API_KEY is not set: falls back silently to the
 * mastery-weighted order (no error, no log spam).
 *
 * If the Cohere call fails at runtime: also falls back silently
 * with a single warning log.
 *
 * Cohere model: rerank-english-v3.0
 * topN: all candidates (we already pre-filtered to 6)
 */

import type { RetrievedChunk } from "./hybrid.js";

const COHERE_MODEL = "rerank-english-v3.0";

// Lazy Cohere client — only instantiated if API key is present
let cohereClient: import("cohere-ai").CohereClient | null = null;

async function getCohere(): Promise<import("cohere-ai").CohereClient | null> {
  if (!process.env.COHERE_API_KEY) return null;
  if (cohereClient) return cohereClient;

  try {
    const { CohereClient } = await import("cohere-ai");
    cohereClient = new CohereClient({ token: process.env.COHERE_API_KEY });
    return cohereClient;
  } catch (err) {
    console.warn(
      "[reranker] Failed to load cohere-ai SDK:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Optionally reranks chunks using Cohere's cross-encoder.
 * Falls back to the input order if Cohere is unavailable or errors.
 *
 * @param query    The user's original query string
 * @param chunks   Mastery-weighted chunks (6 candidates)
 */
export async function rerank(
  query: string,
  chunks: RetrievedChunk[]
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];

  const cohere = await getCohere();
  if (!cohere) {
    // No API key configured — use mastery-weighted order as-is
    return chunks;
  }

  try {
    const documents = chunks.map((c) => c.metadata?.text ?? "");

    const result = await cohere.rerank({
      query,
      documents,
      model: COHERE_MODEL,
      topN: chunks.length,
      returnDocuments: false, // we already have the full chunk objects
    });

    // Reorder chunks by Cohere's relevance score
    const reranked = result.results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .map((r) => {
        const chunk = chunks[r.index];
        if (!chunk) return null;
        return {
          ...chunk,
          // Blend Cohere relevance score into finalScore
          finalScore: r.relevanceScore,
        };
      })
      .filter((c): c is RetrievedChunk => c !== null);

    return reranked;
  } catch (err) {
    console.warn(
      "[reranker] Cohere rerank failed — using mastery-weighted order:",
      err instanceof Error ? err.message : err
    );
    return chunks;
  }
}

/**
 * Returns true if Cohere reranking is configured and enabled.
 * Used by /health to surface reranker status.
 */
export function isCohereEnabled(): boolean {
  return Boolean(process.env.COHERE_API_KEY);
}
