/**
 * apps/backend/src/generation/evaluator.ts
 *
 * Evaluates a student's quiz answer using the LLM.
 *
 * The LLM must return a strict JSON object (no markdown):
 *   { "score": 0.0–1.0, "feedback": "...", "explanation": "..." }
 *
 * Parsing is hardened with:
 *   - Markdown fence stripping
 *   - First JSON object extraction via regex
 *   - Zod validation
 *   - Fallback values if parsing fails
 *
 * The score is the only input to the mastery update formula.
 * feedback is shown to the student.
 * explanation is the correct/complete answer shown after evaluation.
 */

import type { LLMProvider } from "../providers/base.js";
import type { RetrievedChunk } from "../retrieval/hybrid.js";
import { EvalResultSchema, type EvalResult } from "@study-tutor/shared";

const EVAL_SYSTEM = `You are an academic answer evaluator.
Your task is to assess how correct a student's answer is.

Rules:
- Return ONLY valid JSON, no markdown fences, no explanation outside JSON
- score: a decimal from 0.0 (completely wrong) to 1.0 (perfectly correct)
- feedback: 1–2 sentences of constructive feedback for the student
- explanation: the complete correct answer based on the provided context
- Be fair but accurate — partial credit is fine (e.g. 0.6 for mostly correct)
- JSON format: {"score": 0.8, "feedback": "...", "explanation": "..."}`;

/**
 * Safely parses LLM output into an EvalResult.
 * Falls back to score=0.5 with a generic message if parsing fails.
 */
function parseEvalResult(raw: string): EvalResult {
  try {
    // Strip markdown fences
    const cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    // Extract first JSON object in the response
    const match = cleaned.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error("No JSON object found");

    const parsed = JSON.parse(match[0]) as unknown;
    const result = EvalResultSchema.safeParse(parsed);

    if (result.success) return result.data;
    throw new Error("Schema validation failed");
  } catch (err) {
    console.warn(
      "[evaluator] Failed to parse LLM eval response:",
      err instanceof Error ? err.message : err,
      "\nRaw:", raw.slice(0, 200)
    );
    return {
      score: 0.5,
      feedback: "Unable to evaluate your answer automatically. Please review the material.",
      explanation: "Please refer to your study materials for the complete answer.",
    };
  }
}

/**
 * Evaluates a student's answer to a Socratic quiz question.
 *
 * @param question      The Socratic question that was asked
 * @param studentAnswer The student's response
 * @param chunks        The retrieved chunks used as ground truth
 * @param llm           LLM provider instance
 */
export async function evaluateAnswer(
  question: string,
  studentAnswer: string,
  chunks: RetrievedChunk[],
  llm: LLMProvider
): Promise<EvalResult> {
  const contextText = chunks
    .slice(0, 4)
    .map((c, i) => `[${i + 1}] ${c.metadata?.text ?? ""}`)
    .join("\n\n---\n\n");

  const prompt = `Context from study materials:
${contextText}

---

Question asked to student: ${question}

Student's answer: ${studentAnswer}

Evaluate how correct the student's answer is based on the context.
Return ONLY valid JSON (no markdown):
{"score": 0.0-1.0, "feedback": "constructive feedback", "explanation": "complete correct answer"}`;

  const raw = await llm.complete(prompt, EVAL_SYSTEM);
  return parseEvalResult(raw);
}
