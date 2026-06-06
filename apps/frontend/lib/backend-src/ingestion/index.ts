/**
 * apps/backend/src/ingestion/index.ts
 * Barrel export for the ingestion layer.
 */

export { parseFile, getPageForOffset, type ParseResult } from "./parser";
export { chunkDocument, estimateChunkCount, type Chunk } from "./chunker";
export {
  tagChunks,
  inferSubject,
  collectUniqueConcepts,
  type TaggedChunk,
} from "./conceptTagger";
export {
  embedAndUpsert,
  deleteFileVectors,
  pingPinecone,
  getPineconeIndex,
  buildVectorId,
  type ChunkMetadata,
  type EmbedAndUpsertResult,
} from "./embedder";
export {
  runIngestion,
  launchIngestion,
  type UploadedFile,
} from "./pipeline";
