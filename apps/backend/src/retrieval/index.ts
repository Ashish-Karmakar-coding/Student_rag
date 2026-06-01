/**
 * apps/backend/src/retrieval/index.ts
 * Barrel export for the retrieval layer.
 */

export { hybridSearch, type RetrievedChunk } from "./hybrid.js";
export {
  applyMasteryBoost,
  buildMasteryContext,
  findWeakestConcept,
} from "./masteryWeighter.js";
export { rerank, isCohereEnabled } from "./reranker.js";
export { retrieve, type RetrievalResult } from "./retrieve.js";
