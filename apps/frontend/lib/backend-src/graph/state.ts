/**
 * apps/backend/src/graph/state.ts
 *
 * TutorState — the typed state object that flows through the LangGraph.
 * Uses Annotation.Root from @langchain/langgraph 0.2.x.
 *
 * Each field uses the "last-write-wins" reducer (default).
 * The streamCallback is a function — fine for in-memory use (no checkpointing).
 *
 * State lifecycle:
 *   Caller injects: userId, mode, query, providerConfig, streamCallback
 *   Nodes populate: retrievedChunks, masteryContext, promptBuilt,
 *                   responseText, evaluationScore, evaluationFeedback,
 *                   conceptsToUpdate, answerGiven
 */

import { Annotation } from "@langchain/langgraph";
import type { RetrievedChunk } from "../retrieval/hybrid";
import type { ProviderFactoryConfig } from "../providers/factory";

// ── State definition ──────────────────────────────────────────────────────────

export const TutorState = Annotation.Root({
  // ── Injected by caller ────────────────────────────────────────────────────
  userId: Annotation<string>(),

  /** "explain" | "quiz" — may be overridden by classifyIntent node */
  mode: Annotation<"explain" | "quiz">(),

  /** The user's raw query string */
  query: Annotation<string>(),

  /** Provider configuration from User.providerConfig */
  providerConfig: Annotation<ProviderFactoryConfig>(),

  /**
   * SSE stream callback — called by the generate node for each token.
   * Not serialized — in-memory only, no checkpointing.
   */
  streamCallback: Annotation<(token: string) => void>(),

  // ── Set by quiz route before graph invocation ─────────────────────────────
  /** The student's answer to the Socratic question (quiz mode only) */
  answerGiven: Annotation<string>({
    default: () => "",
    reducer: (_, y) => y,
  }),

  /** ID of the quiz question (uuid) — passed through for response */
  questionId: Annotation<string>({
    default: () => "",
    reducer: (_, y) => y,
  }),

  // ── Populated by retrieve node ────────────────────────────────────────────
  retrievedChunks: Annotation<RetrievedChunk[]>({
    default: () => [],
    reducer: (_, y) => y,
  }),

  // ── Populated by fetchMastery node ────────────────────────────────────────
  /** concept → mastery score (0.0–1.0) for all concepts in retrieved chunks */
  masteryContext: Annotation<Record<string, number>>({
    default: () => ({}),
    reducer: (_, y) => y,
  }),

  /** Flat list of all concept tags from retrieved chunks */
  conceptsToUpdate: Annotation<string[]>({
    default: () => [],
    reducer: (_, y) => y,
  }),

  // ── Populated by buildPrompt node ─────────────────────────────────────────
  /** The assembled user prompt (context + question) */
  promptBuilt: Annotation<string>({
    default: () => "",
    reducer: (_, y) => y,
  }),

  /** System prompt for this turn (explain vs quiz differs) */
  systemPrompt: Annotation<string>({
    default: () => "",
    reducer: (_, y) => y,
  }),

  // ── Populated by generate node ────────────────────────────────────────────
  /** Full assembled response text (built token-by-token) */
  responseText: Annotation<string>({
    default: () => "",
    reducer: (_, y) => y,
  }),

  // ── Populated by evaluateAnswer node (quiz mode) ──────────────────────────
  evaluationScore: Annotation<number>({
    default: () => 0,
    reducer: (_, y) => y,
  }),

  evaluationFeedback: Annotation<string>({
    default: () => "",
    reducer: (_, y) => y,
  }),

  evaluationExplanation: Annotation<string>({
    default: () => "",
    reducer: (_, y) => y,
  }),
});

export type TutorStateType = typeof TutorState.State;
