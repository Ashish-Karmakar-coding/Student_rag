/**
 * apps/backend/src/providers/ollama.ts
 *
 * Adapter for a locally running Ollama instance.
 * Implements both LLMProvider and EmbeddingProvider.
 *
 * API endpoints used:
 *   POST /api/generate   → completions (stream or non-stream)
 *   POST /api/embeddings → single-text embedding (no batch endpoint)
 *
 * Timeout: 120s (Ollama can be slow on first load with large models).
 */

import type { LLMProvider, EmbeddingProvider } from "./base.js";
import { ProviderError, ProviderTimeoutError } from "./base.js";

const TIMEOUT_MS = 120_000;
const DEFAULT_URL = "http://localhost:11434";

// ── Types for Ollama API responses ────────────────────────────────────────────

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
  model: string;
}

interface OllamaEmbedResponse {
  embedding: number[];
}

// ── Helper: create an AbortSignal that times out ───────────────────────────────

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(TIMEOUT_MS);
}

// ── OllamaProvider ────────────────────────────────────────────────────────────

export class OllamaProvider implements LLMProvider, EmbeddingProvider {
  private readonly baseUrl: string;

  constructor(
    private readonly model: string,
    ollamaUrl?: string
  ) {
    this.baseUrl = (ollamaUrl ?? DEFAULT_URL).replace(/\/$/, "");
  }

  // ── LLM: non-streaming completion ──────────────────────────────────────────

  async complete(prompt: string, system?: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt,
          system: system ?? "",
          stream: false,
        }),
        signal: timeoutSignal(),
      });

      if (!response.ok) {
        throw new ProviderError(
          "ollama",
          `HTTP ${response.status}: ${await response.text()}`
        );
      }

      const data = (await response.json()) as OllamaGenerateResponse;
      return data.response;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new ProviderTimeoutError("ollama", TIMEOUT_MS);
      }
      throw new ProviderError("ollama", "Completion failed", err);
    }
  }

  // ── LLM: streaming completion ───────────────────────────────────────────────

  async *stream(
    prompt: string,
    system?: string
  ): AsyncGenerator<string, void, unknown> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt,
          system: system ?? "",
          stream: true,
        }),
        signal: timeoutSignal(),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new ProviderTimeoutError("ollama", TIMEOUT_MS);
      }
      throw new ProviderError("ollama", "Stream connection failed", err);
    }

    if (!response.ok) {
      throw new ProviderError(
        "ollama",
        `HTTP ${response.status}: ${await response.text()}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError("ollama", "No response body");

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Ollama streams one JSON object per line
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as OllamaGenerateResponse;
            if (parsed.response) yield parsed.response;
            if (parsed.done) return;
          } catch {
            // Partial JSON line — skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ── Embeddings ──────────────────────────────────────────────────────────────

  async embed(texts: string[]): Promise<number[][]> {
    // Ollama has no batch embedding endpoint — must loop sequentially
    const embeddings: number[][] = [];

    for (const text of texts) {
      try {
        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: this.model, prompt: text }),
          signal: timeoutSignal(),
        });

        if (!response.ok) {
          throw new ProviderError(
            "ollama",
            `Embedding HTTP ${response.status}: ${await response.text()}`
          );
        }

        const data = (await response.json()) as OllamaEmbedResponse;
        embeddings.push(data.embedding);
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        if (err instanceof DOMException && err.name === "TimeoutError") {
          throw new ProviderTimeoutError("ollama", TIMEOUT_MS);
        }
        throw new ProviderError("ollama", "Embedding failed", err);
      }
    }

    return embeddings;
  }

  /** Returns the base URL — used by the health check route. */
  get url(): string {
    return this.baseUrl;
  }
}
