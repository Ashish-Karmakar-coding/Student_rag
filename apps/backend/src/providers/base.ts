/**
 * apps/backend/src/providers/base.ts
 *
 * Core provider interfaces.
 * Both LLMProvider and EmbeddingProvider must be implemented by every adapter.
 * AsyncGenerator allows streaming tokens without buffering the full response.
 */

// ── LLM Provider ──────────────────────────────────────────────────────────────

export interface LLMProvider {
  /**
   * Non-streaming completion.
   * Returns the full response string once the LLM is done.
   * Used for: concept tagging, quiz evaluation (need full JSON), settings test.
   */
  complete(prompt: string, system?: string): Promise<string>;

  /**
   * Streaming completion.
   * Yields text tokens as they arrive from the LLM.
   * Used for: /chat explain mode, /chat quiz question generation.
   */
  stream(prompt: string, system?: string): AsyncGenerator<string, void, unknown>;
}

// ── Embedding Provider ────────────────────────────────────────────────────────

export interface EmbeddingProvider {
  /**
   * Embeds an array of texts and returns their dense vectors.
   * Implementations must respect batch size limits internally.
   * Returns one vector per input text, in the same order.
   */
  embed(texts: string[]): Promise<number[][]>;
}

// ── Combined (for providers that support both) ────────────────────────────────

export type FullProvider = LLMProvider & EmbeddingProvider;

// ── Provider error types ──────────────────────────────────────────────────────

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(provider: string, timeoutMs: number) {
    super(provider, `Request timed out after ${timeoutMs}ms`);
    this.name = "ProviderTimeoutError";
  }
}

export class ProviderAuthError extends ProviderError {
  constructor(provider: string) {
    super(provider, "Invalid or missing API key");
    this.name = "ProviderAuthError";
  }
}
