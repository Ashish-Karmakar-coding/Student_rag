/**
 * apps/backend/src/ingestion/chunker.ts
 *
 * Splits parsed plain text into overlapping chunks for embedding.
 *
 * Uses LangChain's RecursiveCharacterTextSplitter:
 *   chunkSize:    512 chars  (~100–150 tokens — good for retrieval)
 *   chunkOverlap: 64 chars   (~12 tokens — preserves sentence context)
 *   separators:   ["\n\n", "\n", ". ", " "] — natural language breaks first
 *
 * Also computes the character offset of each chunk in the original text
 * so we can recover page numbers from the PDF page map.
 */

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getPageForOffset } from "./parser";
import type { ParseResult } from "./parser";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Chunk {
  text: string;
  index: number;         // 0-based position in the chunk array for this file
  charOffset: number;    // approximate character offset in original text
  page?: number | undefined;         // page number (PDF only)
}

// ── Splitter configuration ────────────────────────────────────────────────────

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 64;

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  separators: ["\n\n", "\n", ". ", " ", ""],
});

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Splits parsed document text into overlapping chunks.
 * Attaches page numbers if a pageMap was provided (PDF files).
 *
 * @param parseResult  Output from parseFile()
 * @returns            Array of Chunk objects
 */
export async function chunkDocument(
  parseResult: ParseResult
): Promise<Chunk[]> {
  const { text, pageMap } = parseResult;

  if (!text.trim()) {
    return [];
  }

  // LangChain splitter returns Document objects with pageContent
  const docs = await splitter.createDocuments([text]);

  const chunks: Chunk[] = [];
  let searchFrom = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const chunkText = doc.pageContent.trim();
    if (!chunkText) continue;

    // Approximate the character offset by searching forward from last position
    // This is inexact due to overlaps but good enough for page attribution
    const found = text.indexOf(chunkText.slice(0, 40), searchFrom);
    const charOffset = found !== -1 ? found : searchFrom;

    // Advance search position (account for overlap)
    searchFrom = Math.max(0, charOffset + chunkText.length - CHUNK_OVERLAP);

    const page = pageMap.length > 0
      ? getPageForOffset(charOffset, pageMap)
      : undefined;

    chunks.push({
      text: chunkText,
      index: i,
      charOffset,
      page,
    });
  }

  return chunks;
}

/**
 * Returns total estimated chunk count for a text without producing them.
 * Used for progress estimates.
 */
export function estimateChunkCount(textLength: number): number {
  if (textLength === 0) return 0;
  const effectiveSize = CHUNK_SIZE - CHUNK_OVERLAP;
  return Math.ceil(textLength / effectiveSize);
}
