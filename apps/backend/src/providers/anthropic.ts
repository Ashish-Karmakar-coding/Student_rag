/**
 * apps/backend/src/providers/anthropic.ts
 *
 * Adapter for the Anthropic Claude API.
 * Implements LLMProvider ONLY — Anthropic has no public embedding endpoint.
 * embed() throws an informative error instructing users to set embedProvider.
 *
 * Models: claude-3-5-sonnet-20241022 (default), claude-3-haiku-20240307, etc.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, EmbeddingProvider } from "./base.js";
import { ProviderError, ProviderAuthError } from "./base.js";
import { getApiKey } from "./keychain.js";

type AnthropicClient = InstanceType<typeof Anthropic>;

const MAX_TOKENS = 4096;

export class AnthropicProvider implements LLMProvider, EmbeddingProvider {
  private clientPromise: Promise<AnthropicClient>;

  constructor(
    private readonly model: string,
    private readonly userId: string
  ) {
    this.clientPromise = this.initClient();
  }

  private async initClient(): Promise<AnthropicClient> {
    const apiKey = await getApiKey(this.userId, "anthropic");
    if (!apiKey) {
      throw new ProviderAuthError("anthropic");
    }
    return new Anthropic({ apiKey }) as AnthropicClient;
  }

  private async client(): Promise<AnthropicClient> {
    return this.clientPromise;
  }

  // ── LLM: non-streaming completion ──────────────────────────────────────────

  async complete(prompt: string, system?: string): Promise<string> {
    try {
      const anthropic = await this.client();
      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: prompt }],
      });

      const block = response.content[0];
      if (block?.type === "text") return block.text;
      return "";
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.toLowerCase().includes("api_key")) {
        throw new ProviderAuthError("anthropic");
      }
      throw new ProviderError("anthropic", `Completion failed: ${msg}`, err);
    }
  }

  // ── LLM: streaming completion ───────────────────────────────────────────────

  async *stream(
    prompt: string,
    system?: string
  ): AsyncGenerator<string, void, unknown> {
    try {
      const anthropic = await this.client();
      const stream = anthropic.messages.stream({
        model: this.model,
        max_tokens: MAX_TOKENS,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: prompt }],
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.toLowerCase().includes("api_key")) {
        throw new ProviderAuthError("anthropic");
      }
      throw new ProviderError("anthropic", `Stream failed: ${msg}`, err);
    }
  }

  // ── Embeddings: not supported ──────────────────────────────────────────────

  async embed(_texts: string[]): Promise<number[][]> {
    throw new ProviderError(
      "anthropic",
      "Anthropic does not support text embeddings. " +
        "Set embedProvider to 'ollama' or 'openai' in your settings."
    );
  }
}
