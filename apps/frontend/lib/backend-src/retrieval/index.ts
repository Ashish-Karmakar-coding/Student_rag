/**
 * apps/backend/src/retrieval/index.ts
 * Barrel export for the retrieval layer.
 */

export { hybridSearch, type RetrievedChunk } from "./hybrid";
export {
  applyMasteryBoost,
  buildMasteryContext,
  findWeakestConcept,
} from "./masteryWeighter";
export { rerank, isCohereEnabled } from "./reranker";
export { retrieve, type RetrievalResult } from "./retrieve";
