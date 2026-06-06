/**
 * apps/backend/src/ingestion/conceptTagger.ts
 *
 * Extracts academic concept tags from each chunk using an LLM.
 *
 * Prompt design:
 *   - Asks for 2–5 lowercase concept strings
 *   - Requests a strict JSON array (no markdown fences, no explanation)
 *   - Falls back to ["general"] on any parse failure
 *
 * Batching strategy:
 *   - Processes chunks in groups of BATCH_SIZE to limit concurrent LLM calls
 *   - Each call is independent; one failure doesn't abort the whole file
 *
 * Subject inference:
 *   - After tagging all chunks, the most frequent concept prefix is used
 *     as the "subject" for the file (e.g. "biology", "history")
 */

import type { LLMProvider } from "../providers/base";
import { ConceptTagArraySchema } from "@study-tutor/shared";
import type { Chunk } from "./chunker";

const BATCH_SIZE = 5; // parallel LLM calls per batch
const FALLBACK_TAG = ["general"];

// ── Tagging system prompt ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an academic concept extractor.
Your job is to identify the key academic concepts discussed in a text excerpt.
Rules:
- Return ONLY a valid JSON array of lowercase strings
- Include 2 to 5 concepts per chunk
- Use specific academic terms (e.g. "mitosis" not "biology stuff")
- No markdown code fences, no explanation, just the raw JSON array
- Example output: ["mitosis","cell cycle","spindle fibres"]`;

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildTagPrompt(chunkText: string): string {
  // Trim to 800 chars — LLM doesn't need the full chunk for tagging
  const trimmed = chunkText.slice(0, 800);
  return `Extract 2–5 key academic concepts from this text excerpt.
Return ONLY a valid JSON array of lowercase strings. No markdown.

Text:
${trimmed}`;
}

// ── Safe JSON parse for LLM output ───────────────────────────────────────────

function parseTagsFromLLM(raw: string): string[] {
  try {
    // Strip any accidental markdown fences the LLM may have added
    const cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    // Find the first JSON array in the response
    const match = cleaned.match(/\[[\s\S]*?\]/);
    if (!match) return FALLBACK_TAG;

    const parsed = JSON.parse(match[0]) as unknown;
    const result = ConceptTagArraySchema.safeParse(parsed);

    if (result.success && result.data.length > 0) {
      // Normalize: lowercase, trim whitespace, remove empty strings
      return result.data
        .map((t) => t.toLowerCase().trim())
        .filter((t) => t.length > 0);
    }

    return FALLBACK_TAG;
  } catch {
    return FALLBACK_TAG;
  }
}

// ── Single chunk tagger ───────────────────────────────────────────────────────

async function tagChunk(
  chunk: Chunk,
  llm: LLMProvider
): Promise<string[]> {
  try {
    const raw = await llm.complete(buildTagPrompt(chunk.text), SYSTEM_PROMPT);
    return parseTagsFromLLM(raw);
  } catch (err) {
    console.warn(
      `[conceptTagger] Failed to tag chunk ${chunk.index}:`,
      err instanceof Error ? err.message : err
    );
    return FALLBACK_TAG;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface TaggedChunk extends Chunk {
  conceptTags: string[];
}

/**
 * Tags all chunks in a document with concept labels.
 * Processes in batches of BATCH_SIZE to avoid overwhelming the LLM.
 *
 * @param chunks  Chunks from chunkDocument()
 * @param llm     The LLM provider for this user
 * @returns       Chunks with conceptTags attached
 */
export async function tagChunks(
  chunks: Chunk[],
  llm: LLMProvider
): Promise<TaggedChunk[]> {
  const tagged: TaggedChunk[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map((chunk) => tagChunk(chunk, llm))
    );

    for (let j = 0; j < batch.length; j++) {
      tagged.push({
        ...batch[j]!,
        conceptTags: results[j] ?? FALLBACK_TAG,
      });
    }
  }

  return tagged;
}

/**
 * Infers a single subject label for a whole file from its tagged chunks.
 * Uses the most frequently appearing concept as a rough subject proxy.
 * Returns "general" if no clear winner.
 */
export function inferSubject(taggedChunks: TaggedChunk[]): string {
  const freq = new Map<string, number>();

  for (const chunk of taggedChunks) {
    for (const tag of chunk.conceptTags) {
      freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
  }

  if (freq.size === 0) return "general";

  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "general";
}

/**
 * Collects all unique concept tags from a set of tagged chunks.
 */
export function collectUniqueConcepts(chunks: TaggedChunk[]): string[] {
  const set = new Set<string>();
  for (const chunk of chunks) {
    for (const tag of chunk.conceptTags) {
      set.add(tag);
    }
  }
  return [...set];
}
