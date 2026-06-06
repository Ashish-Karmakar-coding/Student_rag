/**
 * apps/backend/src/providers/openai.ts
 *
 * Adapter for the OpenAI API.
 * Implements both LLMProvider and EmbeddingProvider.
 *
 * Models:
 *   LLM:       gpt-4o-mini (default), gpt-4o, gpt-3.5-turbo, etc.
 *   Embedding: text-embedding-3-small (1536 dims) — default
 *
 * API key is retrieved from the OS keychain per-user via keytar.
 */

import OpenAI from "openai";
import type { LLMProvider, EmbeddingProvider } from "./base";
import { ProviderError, ProviderAuthError } from "./base";
import { getApiKey } from "./keychain";

const EMBED_MODEL_DEFAULT = "text-embedding-3-small";
const EMBED_BATCH_SIZE = 32;

export class OpenAIProvider implements LLMProvider, EmbeddingProvider {
  private clientPromise: Promise<OpenAI>;

  constructor(
    private readonly model: string,
    private readonly userId: string,
    private readonly embedModel: string = EMBED_MODEL_DEFAULT
  ) {
    // Initialise client lazily — getApiKey is async
    this.clientPromise = this.initClient();
  }

  private async initClient(): Promise<OpenAI> {
    const apiKey = await getApiKey(this.userId, "openai");
    if (!apiKey) {
      throw new ProviderAuthError("openai");
    }
    return new OpenAI({ apiKey });
  }

  private async client(): Promise<OpenAI> {
    return this.clientPromise;
  }

  // ── LLM: non-streaming completion ──────────────────────────────────────────

  async complete(prompt: string, system?: string): Promise<string> {
    try {
      const openai = await this.client();
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          ...(system ? [{ role: "system" as const, content: system }] : []),
          { role: "user" as const, content: prompt },
        ],
        stream: false,
      });

      return response.choices[0]?.message.content ?? "";
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      // Detect 401 auth errors
      if (msg.includes("401") || msg.toLowerCase().includes("api key")) {
        throw new ProviderAuthError("openai");
      }
      throw new ProviderError("openai", `Completion failed: ${msg}`, err);
    }
  }

  // ── LLM: streaming completion ───────────────────────────────────────────────

  async *stream(
    prompt: string,
    system?: string
  ): AsyncGenerator<string, void, unknown> {
    try {
      const openai = await this.client();
      const stream = await openai.chat.completions.create({
        model: this.model,
        messages: [
          ...(system ? [{ role: "system" as const, content: system }] : []),
          { role: "user" as const, content: prompt },
        ],
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta.content;
        if (delta) yield delta;
      }
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.toLowerCase().includes("api key")) {
        throw new ProviderAuthError("openai");
      }
      throw new ProviderError("openai", `Stream failed: ${msg}`, err);
    }
  }

  // ── Embeddings ──────────────────────────────────────────────────────────────

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const openai = await this.client();
    const results: number[][] = [];

    // Process in batches of 32
    for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBED_BATCH_SIZE);

      try {
        const response = await openai.embeddings.create({
          model: this.embedModel,
          input: batch,
        });

        // Preserve order — API returns in same order as input
        const sorted = response.data.sort((a, b) => a.index - b.index);
        results.push(...sorted.map((d) => d.embedding));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("401") || msg.toLowerCase().includes("api key")) {
          throw new ProviderAuthError("openai");
        }
        throw new ProviderError("openai", `Embedding batch failed: ${msg}`, err);
      }
    }

    return results;
  }
}
