/**
 * apps/backend/src/graph/tutorGraph.ts
 *
 * Assembles and compiles the LangGraph StateGraph.
 *
 * Graph topology:
 *
 *   __start__
 *       │
 *   classifyIntent
 *       │
 *    retrieve
 *       │
 *   fetchMastery
 *       │
 *   buildPrompt
 *       │
 *    generate
 *       │
 *   ┌───┴───────────────────────────────┐
 *   │ mode === "quiz"?                  │
 *   │ yes → evaluateAnswer → updateMastery → END
 *   │ no  → END
 *   └───────────────────────────────────┘
 *
 * The graph is compiled once at module load time and reused for every request.
 * Since we're not using checkpointing, there's no thread-safety concern.
 */

import { StateGraph, END } from "@langchain/langgraph";
import { TutorState } from "./state";
import {
  classifyIntent,
  retrieveChunks,
  fetchMastery,
  buildPrompt,
  generate,
  evaluateAnswer,
  updateMastery,
} from "./nodes";
import type { TutorStateType } from "./state";

// ── Build the graph ───────────────────────────────────────────────────────────

const graph = new StateGraph(TutorState)
  // ── Nodes ────────────────────────────────────────────────────────────────
  .addNode("classifyIntent", classifyIntent)
  .addNode("retrieve",       retrieveChunks)
  .addNode("fetchMastery",   fetchMastery)
  .addNode("buildPrompt",    buildPrompt)
  .addNode("generate",       generate)
  .addNode("evaluateAnswer", evaluateAnswer)
  .addNode("updateMastery",  updateMastery)

  // ── Linear edges (always taken) ───────────────────────────────────────────
  .addEdge("__start__",    "classifyIntent")
  .addEdge("classifyIntent", "retrieve")
  .addEdge("retrieve",     "fetchMastery")
  .addEdge("fetchMastery", "buildPrompt")
  .addEdge("buildPrompt",  "generate")

  // ── Conditional edge: quiz vs explain ─────────────────────────────────────
  .addConditionalEdges(
    "generate",
    (state: TutorStateType) => state.mode === "quiz" ? "evaluateAnswer" : END,
    {
      evaluateAnswer: "evaluateAnswer",
      [END]: END,
    }
  )

  // ── Quiz completion path ──────────────────────────────────────────────────
  .addEdge("evaluateAnswer", "updateMastery")
  .addEdge("updateMastery",  END);

// ── Compile ───────────────────────────────────────────────────────────────────

export const tutorGraph = graph.compile();

// ── Invocation helper ─────────────────────────────────────────────────────────

export type TutorGraphInput = Pick<
  TutorStateType,
  "userId" | "mode" | "query" | "providerConfig" | "streamCallback"
> & {
  answerGiven?: string;
  questionId?: string;
};

/**
 * Invokes the tutor graph with the given inputs.
 * This is the single call site used by route handlers.
 *
 * @param input  Caller-provided fields (all required fields)
 * @returns      Final graph state (post all nodes)
 */
export async function runTutorGraph(
  input: TutorGraphInput
): Promise<TutorStateType> {
  const result = await tutorGraph.invoke({
    userId: input.userId,
    mode: input.mode,
    query: input.query,
    providerConfig: input.providerConfig,
    streamCallback: input.streamCallback,
    answerGiven: input.answerGiven ?? "",
    questionId: input.questionId ?? "",
  });

  return result as TutorStateType;
}
