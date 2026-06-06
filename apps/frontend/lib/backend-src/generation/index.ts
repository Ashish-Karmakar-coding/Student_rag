/**
 * apps/backend/src/generation/index.ts
 * Barrel export for the generation layer.
 */

export {
  EXPLAIN_SYSTEM,
  buildExplainPrompt,
} from "./explainer";

export {
  SOCRATIC_SYSTEM,
  getDifficulty,
  buildSocraticPrompt,
  parseSocraticResponse,
} from "./socratic";

export { evaluateAnswer } from "./evaluator";
