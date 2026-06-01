/**
 * apps/backend/src/generation/index.ts
 * Barrel export for the generation layer.
 */

export {
  EXPLAIN_SYSTEM,
  buildExplainPrompt,
} from "./explainer.js";

export {
  SOCRATIC_SYSTEM,
  getDifficulty,
  buildSocraticPrompt,
  parseSocraticResponse,
} from "./socratic.js";

export { evaluateAnswer } from "./evaluator.js";
