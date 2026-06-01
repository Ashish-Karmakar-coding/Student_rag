/**
 * apps/backend/src/ingestion/index.ts
 * Barrel export for the ingestion layer.
 */

export { parseFile, getPageForOffset, type ParseResult } from "./parser.js";
export { chunkDocument, estimateChunkCount, type Chunk } from "./chunker.js";
export {
  tagChunks,
  inferSubject,
  collectUniqueConcepts,
  type TaggedChunk,
} from "./conceptTagger.js";
export {
  embedAndUpsert,
  deleteFileVectors,
  pingPinecone,
  getPineconeIndex,
  buildVectorId,
  type ChunkMetadata,
  type EmbedAndUpsertResult,
} from "./embedder.js";
export {
  runIngestion,
  launchIngestion,
  type UploadedFile,
} from "./pipeline.js";
