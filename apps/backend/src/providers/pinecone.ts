/**
 * apps/backend/src/providers/pinecone.ts
 *
 * EmbeddingProvider that delegates to Pinecone's hosted Inference API.
 * No local model or external API key is needed beyond the PINECONE_API_KEY
 * already used by the rest of the backend.
 *
 * Supported models (as of 2025):
 *   - "llama-text-embed-v2"         → 1024-dim, up to 2048 tokens (recommended)
 *   - "multilingual-e5-large"       → 1024-dim, up to 507 tokens
 *   - "multilingual-e5-large-instruct"
 *
 * The Pinecone SDK batches internally, but we still chunk inputs to stay well
 * under the per-request limit (96 inputs max per call).
 *
 * For asymmetric models like llama-text-embed-v2 the SDK applies the
 * correct input_type automatically based on the `inputType` parameter:
 *   - "passage" for documents being indexed
 *   - "query"   for search queries
 */

import { Pinecone } from "@pinecone-database/pinecone";
import type { EmbeddingProvider } from "./base.js";
import { ProviderError } from "./base.js";
import { env } from "../config.js";

/** Maximum texts per single Pinecone inference request */
const PINECONE_EMBED_BATCH = 96;

let _client: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!_client) {
    _client = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  }
  return _client;
}

export class PineconeEmbeddingProvider implements EmbeddingProvider {
  private readonly model: string;
  private readonly inputType: "passage" | "query";

  constructor(
    model = "llama-text-embed-v2",
    inputType: "passage" | "query" = "passage"
  ) {
    this.model = model;
    this.inputType = inputType;
  }

  /**
   * Returns a new provider configured for query embedding.
   * Query embeddings must use inputType="query" for asymmetric models.
   */
  forQuery(): PineconeEmbeddingProvider {
    return new PineconeEmbeddingProvider(this.model, "query");
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const pc = getPineconeClient();
    const results: number[][] = [];

    // Batch to stay under Pinecone's per-request limit
    for (let i = 0; i < texts.length; i += PINECONE_EMBED_BATCH) {
      const batch = texts.slice(i, i + PINECONE_EMBED_BATCH);

      let response;
      try {
        response = await pc.inference.embed({
          model: this.model,
          inputs: batch,
          parameters: { inputType: this.inputType, truncate: "END" }
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new ProviderError(
          "pinecone",
          `Inference API embed failed: ${message}`,
          err
        );
      }

      // The response data array is in the same order as the input
      for (const rawEmbedding of response.data) {
        const values = (rawEmbedding as any).values as number[] | undefined;
        if (values == null) {
          throw new ProviderError(
            "pinecone",
            `Received null embedding from Pinecone for model "${this.model}"`
          );
        }
        results.push(values);
      }
    }

    return results;
  }
}
