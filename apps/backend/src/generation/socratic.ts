/**
 * apps/backend/src/generation/socratic.ts
 *
 * Prompt builders for "quiz" / Socratic mode.
 * Generates guiding questions that lead students to discover concepts.
 *
 * Difficulty tiers:
 *   score < 0.35  → foundational  (basic recall)
 *   score < 0.65  → intermediate  (application)
 *   score >= 0.65 → advanced      (analysis/synthesis)
 */

import type { RetrievedChunk } from "../retrieval/hybrid.js";
import type { QuizDifficulty } from "@study-tutor/shared";

export const SOCRATIC_SYSTEM = `You are a Socratic tutor.
Your job is to help students discover knowledge through guided questioning.

Rules:
- NEVER give the answer directly
- Ask exactly ONE guiding question per response
- The question should lead the student to reason through the concept themselves
- Use the provided context as the basis for your question
- Match the difficulty level specified
- Make the question specific, not vague
- End with a "Hint:" line that gives a subtle nudge without revealing the answer`;

/**
 * Derives difficulty tier from mastery score.
 */
export function getDifficulty(score: number): QuizDifficulty {
  if (score < 0.35) return "foundational";
  if (score < 0.65) return "intermediate";
  return "advanced";
}

/**
 * Builds the user prompt for Socratic question generation.
 */
export function buildSocraticPrompt(
  weakestConcept: string,
  masteryScore: number,
  chunks: RetrievedChunk[]
): string {
  const difficulty = getDifficulty(masteryScore);
  const masteryPct = Math.round(masteryScore * 100);

  const contextText = chunks
    .slice(0, 4) // Use top 4 chunks for question generation
    .map((chunk, i) => `[${i + 1}] ${chunk.metadata?.text ?? ""}`)
    .join("\n\n---\n\n");

  return `Context from study materials:
${contextText}

---

Target concept: "${weakestConcept}"
Student mastery: ${masteryPct}% (${difficulty} level)
Difficulty tier: ${difficulty}

Generate ONE Socratic guiding question about "${weakestConcept}" at the ${difficulty} level.
The question should help the student think through the concept.

Format your response as:
Question: [your single question here]
Hint: [a subtle nudge, no more than one sentence]`;
}

/**
 * Parses the LLM's Socratic response into question + hint parts.
 */
export function parseSocraticResponse(raw: string): {
  question: string;
  hint: string;
} {
  const questionMatch = raw.match(/Question:\s*(.+?)(?=Hint:|$)/si);
  const hintMatch = raw.match(/Hint:\s*(.+?)$/si);

  const question = questionMatch?.[1]?.trim() ?? raw.trim();
  const hint = hintMatch?.[1]?.trim() ?? "Think about the underlying mechanism.";

  return { question, hint };
}
