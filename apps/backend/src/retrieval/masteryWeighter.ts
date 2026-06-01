/**
 * apps/backend/src/retrieval/masteryWeighter.ts
 *
 * Re-weights retrieved chunks to boost those covering concepts
 * the user struggles with most.
 *
 * Boost formula (per chunk):
 *   finalScore = rrfScore * (1 + (1 - minConceptScore) * 0.8)
 *
 * Intuition:
 *   - A chunk whose weakest concept has score 0.05 (struggling) gets
 *     boost = 1 + 0.95*0.8 = 1.76  → nearly doubled
 *   - A chunk whose weakest concept has score 0.99 (mastered) gets
 *     boost = 1 + 0.01*0.8 = 1.008 → barely changed
 *   - Unknown concepts (not in mastery) default to 0.5 (neutral)
 *
 * This ensures the tutor naturally gravitates toward weak spots
 * without ever completely ignoring strong areas.
 */

import { Mastery } from "../models/Mastery.js";
import type { RetrievedChunk } from "./hybrid.js";

const BOOST_FACTOR = 0.8;
const UNKNOWN_CONCEPT_SCORE = 0.5; // neutral assumption for unseen concepts

// ── Per-chunk mastery context ─────────────────────────────────────────────────

export interface ChunkMasteryContext {
  /** Map of concept → mastery score for concepts in this chunk */
  conceptScores: Record<string, number>;
  /** The lowest-scoring concept — used for boost calculation */
  weakestConcept: string;
  weakestScore: number;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Applies mastery-based score boosting to a list of retrieved chunks.
 * Looks up MongoDB mastery scores for all concept tags in one query.
 * Returns chunks sorted by finalScore descending.
 *
 * @param chunks   Output of hybridSearch()
 * @param userId   GitHub user ID
 */
export async function applyMasteryBoost(
  chunks: RetrievedChunk[],
  userId: string
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];

  // Collect all unique concept tags across all chunks
  const allConcepts = new Set<string>();
  for (const chunk of chunks) {
    const tags = chunk.metadata?.conceptTags ?? [];
    for (const tag of tags) {
      allConcepts.add(tag);
    }
  }

  // Single MongoDB query for all concepts at once
  const masteryDocs = await Mastery.find({
    userId,
    concept: { $in: [...allConcepts] },
  }).lean();

  // Build a fast lookup map: concept → score
  const scoreMap = new Map<string, number>();
  for (const doc of masteryDocs) {
    scoreMap.set(doc.concept, doc.score);
  }

  // Apply boost to each chunk
  const boosted = chunks.map((chunk) => {
    const tags = chunk.metadata?.conceptTags ?? [];

    if (tags.length === 0) {
      // No concept tags — no boost applied
      return { ...chunk };
    }

    const scores = tags.map(
      (tag) => scoreMap.get(tag) ?? UNKNOWN_CONCEPT_SCORE
    );
    const minScore = Math.min(...scores);
    const boost = 1 + (1 - minScore) * BOOST_FACTOR;

    return {
      ...chunk,
      finalScore: chunk.finalScore * boost,
    };
  });

  // Re-sort by boosted score
  return boosted.sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Builds mastery context for the LangGraph state.
 * Returns a map of concept → score for all concepts in the given chunks.
 *
 * @param chunks   Retrieved chunks (post-boost)
 * @param userId   GitHub user ID
 */
export async function buildMasteryContext(
  chunks: RetrievedChunk[],
  userId: string
): Promise<Record<string, number>> {
  const allConcepts = new Set<string>();
  for (const chunk of chunks) {
    for (const tag of chunk.metadata?.conceptTags ?? []) {
      allConcepts.add(tag);
    }
  }

  if (allConcepts.size === 0) return {};

  const docs = await Mastery.find({
    userId,
    concept: { $in: [...allConcepts] },
  }).lean();

  const context: Record<string, number> = {};
  for (const doc of docs) {
    context[doc.concept] = doc.score;
  }

  // Fill in neutral score for any concepts not yet in mastery
  for (const concept of allConcepts) {
    if (!(concept in context)) {
      context[concept] = UNKNOWN_CONCEPT_SCORE;
    }
  }

  return context;
}

/**
 * Finds the weakest concept from a mastery context map.
 * Returns the concept name and its score.
 */
export function findWeakestConcept(
  masteryContext: Record<string, number>
): { concept: string; score: number } {
  const entries = Object.entries(masteryContext);
  if (entries.length === 0) {
    return { concept: "general", score: 0.5 };
  }
  const sorted = entries.sort(([, a], [, b]) => a - b);
  const [concept, score] = sorted[0]!;
  return { concept, score };
}
