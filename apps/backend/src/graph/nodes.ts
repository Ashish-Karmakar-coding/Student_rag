/**
 * apps/backend/src/graph/nodes.ts
 *
 * All LangGraph node functions for the TutorGraph.
 * Each function receives the full TutorState and returns a partial state update.
 *
 * Node execution order:
 *   classifyIntent → retrieve → fetchMastery → buildPrompt → generate
 *     → (quiz only) evaluateAnswer → updateMastery
 */

import { retrieve } from "../retrieval/retrieve.js";
import { findWeakestConcept } from "../retrieval/masteryWeighter.js";
import { getLLMProvider, getQueryEmbeddingProvider, isProviderReachable } from "../providers/factory.js";
import {
  EXPLAIN_SYSTEM,
  buildExplainPrompt,
  SOCRATIC_SYSTEM,
  buildSocraticPrompt,
} from "../generation/index.js";
import { evaluateAnswer as evalAnswer } from "../generation/evaluator.js";
import { Mastery, calcNewMasteryScore } from "../models/Mastery.js";
import type { TutorStateType } from "./state.js";

// ── Helper types ──────────────────────────────────────────────────────────────

type NodeInput = TutorStateType;
type NodeOutput = Partial<TutorStateType>;

// ── Quiz trigger keywords ─────────────────────────────────────────────────────

const QUIZ_KEYWORDS = [
  "quiz", "test me", "ask me", "question", "drill",
  "practice", "examine", "challenge me", "what do i know",
];

// ── Node: classifyIntent ──────────────────────────────────────────────────────

/**
 * Heuristic classifier — checks for quiz trigger keywords in the query.
 * Sets mode to "quiz" if found; otherwise keeps "explain".
 * No LLM call needed — fast and deterministic.
 */
export async function classifyIntent(state: NodeInput): Promise<NodeOutput> {
  const lower = state.query.toLowerCase();
  const isQuiz = QUIZ_KEYWORDS.some((kw) => lower.includes(kw));

  // If mode was explicitly set to quiz by the caller, keep it
  const mode = state.mode === "quiz" || isQuiz ? "quiz" : "explain";
  return { mode };
}

// ── Node: retrieve ────────────────────────────────────────────────────────────

/**
 * Runs the full hybrid retrieval pipeline.
 * Returns retrievedChunks + masteryContext together to avoid a double DB query.
 */
export async function retrieveChunks(state: NodeInput): Promise<NodeOutput> {
  const embedder = getQueryEmbeddingProvider(state.providerConfig);

  const { chunks, masteryContext } = await retrieve(
    state.query,
    state.userId,
    embedder
  );

  return { retrievedChunks: chunks, masteryContext };
}

// ── Node: fetchMastery ────────────────────────────────────────────────────────

/**
 * Extracts the flat list of all unique concept tags from retrieved chunks.
 * masteryContext was already populated by the retrieve node.
 * This node computes conceptsToUpdate for the updateMastery node.
 */
export async function fetchMastery(state: NodeInput): Promise<NodeOutput> {
  const allConcepts = new Set<string>();
  for (const chunk of state.retrievedChunks) {
    for (const tag of chunk.metadata?.conceptTags ?? []) {
      allConcepts.add(tag);
    }
  }
  return { conceptsToUpdate: [...allConcepts] };
}

// ── Node: buildPrompt ─────────────────────────────────────────────────────────

/**
 * Assembles the system prompt and user prompt based on mode.
 * Explain mode: factual explanation from context.
 * Quiz mode:    Socratic guiding question targeting weakest concept.
 */
export async function buildPrompt(state: NodeInput): Promise<NodeOutput> {
  if (state.mode === "explain") {
    return {
      systemPrompt: EXPLAIN_SYSTEM,
      promptBuilt: buildExplainPrompt(state.query, state.retrievedChunks),
    };
  }

  // Quiz mode: target the weakest concept
  const { concept: weakestConcept, score: weakestScore } =
    findWeakestConcept(state.masteryContext);

  return {
    systemPrompt: SOCRATIC_SYSTEM,
    promptBuilt: buildSocraticPrompt(
      weakestConcept,
      weakestScore,
      state.retrievedChunks
    ),
  };
}

// ── Node: generate ────────────────────────────────────────────────────────────

/**
 * Streams LLM tokens to the SSE callback and assembles the full responseText.
 * The streamCallback is injected by the /chat route before graph invocation.
 */
export async function generate(state: NodeInput): Promise<NodeOutput> {
  const reachable = await isProviderReachable(state.providerConfig);
  if (!reachable) {
    // Stream a user-visible error message instead of crashing
    const errMsg =
      `\n\n⚠️ LLM provider "${state.providerConfig.provider}" is not reachable from the server. ` +
      `Please go to **Settings** and switch to OpenAI or Anthropic for cloud-hosted responses.`;
    state.streamCallback(errMsg);
    return { responseText: errMsg };
  }

  const llm = getLLMProvider(state.providerConfig);
  let responseText = "";

  try {
    for await (const token of llm.stream(state.promptBuilt, state.systemPrompt)) {
      state.streamCallback(token);
      responseText += token;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM stream failed";
    console.error("[nodes/generate] stream error:", msg);
    state.streamCallback(`\n\n⚠️ Generation failed: ${msg}`);
    responseText += `\n\n⚠️ Generation failed: ${msg}`;
  }

  return { responseText };
}

// ── Node: evaluateAnswer ──────────────────────────────────────────────────────

/**
 * Evaluates the student's answer against the generated Socratic question.
 * Only runs in quiz mode after the student submits an answer.
 */
export async function evaluateAnswer(state: NodeInput): Promise<NodeOutput> {
  const llm = getLLMProvider(state.providerConfig);

  const result = await evalAnswer(
    state.responseText,   // the Socratic question text
    state.answerGiven,    // the student's answer
    state.retrievedChunks,
    llm
  );

  return {
    evaluationScore: result.score,
    evaluationFeedback: result.feedback,
    evaluationExplanation: result.explanation,
  };
}

// ── Node: updateMastery ───────────────────────────────────────────────────────

/**
 * Applies the mastery update formula to all concepts touched in this session.
 * newScore = clamp(old + 0.15 * (correctness - old), 0.05, 0.99)
 *
 * In explain mode: evaluationScore = 0 (no quiz happened) — skipped via
 * conditional edge, so this node only runs in quiz mode.
 */
export async function updateMastery(state: NodeInput): Promise<NodeOutput> {
  const { userId, conceptsToUpdate, evaluationScore } = state;

  await Promise.all(
    conceptsToUpdate.map(async (concept) => {
      const existing = await Mastery.findOne({ userId, concept }).lean();
      const oldScore = existing?.score ?? 0.5;
      const newScore = calcNewMasteryScore(oldScore, evaluationScore);

      await Mastery.updateOne(
        { userId, concept },
        {
          $set: { score: newScore, lastTested: new Date() },
          $inc: {
            attemptCount: 1,
            correctCount: evaluationScore > 0.6 ? 1 : 0,
          },
        },
        { upsert: true }
      );
    })
  );

  return {};
}
