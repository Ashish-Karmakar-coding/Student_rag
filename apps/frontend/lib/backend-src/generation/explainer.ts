/**
 * apps/backend/src/generation/explainer.ts
 *
 * Prompt builder for "explain" mode.
 * Builds the system prompt and user prompt from retrieved context chunks.
 */

import type { RetrievedChunk } from "../retrieval/hybrid";

export const EXPLAIN_SYSTEM = `You are a patient, expert academic tutor.
Your role is to explain complex concepts clearly using ONLY the provided context.

Rules:
- Answer using ONLY information present in the provided context
- Never fabricate facts, statistics, or details not in the context
- Cite which concept you are explaining (e.g. "Regarding mitosis...")
- Use clear, structured explanations with examples where helpful
- If the context does not contain enough information, say so honestly
- Keep your response concise but complete`;

/**
 * Builds the user-facing prompt for explain mode.
 * Formats retrieved chunks as a numbered context block.
 */
export function buildExplainPrompt(
  query: string,
  chunks: RetrievedChunk[]
): string {
  const contextText = chunks
    .map((chunk, i) => {
      const source = chunk.metadata?.fileName ?? "unknown";
      const page = chunk.metadata?.page ? ` (p.${chunk.metadata.page})` : "";
      return `[${i + 1}] ${source}${page}:\n${chunk.metadata?.text ?? ""}`;
    })
    .join("\n\n---\n\n");

  return `Context from your study materials:
${contextText}

---

Student question: ${query}

Please explain clearly using only the context above.`;
}
