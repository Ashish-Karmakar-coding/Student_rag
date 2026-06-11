/**
 * apps/backend/src/providers/anthropic.ts
 *
 * Adapter for the Anthropic Claude API.
 * Implements LLMProvider ONLY — Anthropic has no public embedding endpoint.
 * embed() throws an informative error instructing users to set embedProvider.
 *
 * Models: claude-3-5-sonnet-20241022 (default), claude-3-haiku-20240307, etc.
 */

import AnthropicLib from "@anthropic-ai/sdk";
import type { LLMProvider, EmbeddingProvider } from "./base.js";
import { ProviderError, ProviderAuthError } from "./base.js";
import { getApiKey } from "./keychain.js";

// Cast to `any` to avoid TypeScript module resolution issues across
// different anthropic SDK versions and moduleResolution settings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Anthropic: any = AnthropicLib;

const MAX_TOKENS = 4096;

export class AnthropicProvider implements LLMProvider, EmbeddingProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clientPromise: Promise<any>;

  constructor(
    private readonly model: string,
    private readonly userId: string
  ) {
    this.clientPromise = this.initClient();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async initClient(): Promise<any> {
    const apiKey = await getApiKey(this.userId, "anthropic");
    if (!apiKey) {
      throw new ProviderAuthError("anthropic");
    }
    return new Anthropic({ apiKey });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async client(): Promise<any> {
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
