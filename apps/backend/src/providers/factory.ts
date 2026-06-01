/**
 * apps/backend/src/providers/factory.ts
 *
 * Creates the correct LLMProvider / EmbeddingProvider from a user's stored
 * providerConfig. All routing logic lives here — route handlers just call
 * getLLMProvider(user.providerConfig) and get the right adapter back.
 *
 * Key rule: Anthropic has no embedding API.
 *   → When provider === "anthropic" and embedProvider is not set,
 *     automatically fall back to OllamaProvider("nomic-embed-text").
 */

import { OllamaProvider } from "./ollama.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import type { LLMProvider, EmbeddingProvider } from "./base.js";
import { ProviderError } from "./base.js";

// ── Minimal config shape required by the factory ──────────────────────────────

export interface ProviderFactoryConfig {
  provider: "ollama" | "openai" | "anthropic";
  model: string;
  ollamaUrl?: string;
  embedProvider?: string;      // "ollama" | "openai"
  embedModel?: string;
  userId?: string;             // required for cloud providers
}

// ── LLM Provider factory ──────────────────────────────────────────────────────

/**
 * Returns an LLMProvider for the given config.
 * For cloud providers, userId is required to look up the API key.
 */
export function getLLMProvider(cfg: ProviderFactoryConfig): LLMProvider {
  switch (cfg.provider) {
    case "ollama":
      return new OllamaProvider(cfg.model, cfg.ollamaUrl);

    case "openai":
      if (!cfg.userId) {
        throw new ProviderError("openai", "userId is required for OpenAI provider");
      }
      return new OpenAIProvider(cfg.model, cfg.userId, cfg.embedModel);

    case "anthropic":
      if (!cfg.userId) {
        throw new ProviderError("anthropic", "userId is required for Anthropic provider");
      }
      return new AnthropicProvider(cfg.model, cfg.userId);

    default: {
      const _exhaustive: never = cfg.provider;
      throw new ProviderError("unknown", `Unknown provider: ${String(_exhaustive)}`);
    }
  }
}

// ── Embedding Provider factory ────────────────────────────────────────────────

/**
 * Returns an EmbeddingProvider for the given config.
 *
 * Resolution order:
 * 1. If embedProvider is explicitly "openai" → OpenAIProvider (with embedModel)
 * 2. If embedProvider is explicitly "ollama" → OllamaProvider (nomic-embed-text)
 * 3. If provider is "anthropic" (no embeddings) → fall back to OllamaProvider
 * 4. Otherwise: use the same provider as the LLM
 */
export function getEmbeddingProvider(cfg: ProviderFactoryConfig): EmbeddingProvider {
  const ep = cfg.embedProvider ?? cfg.provider;

  // Anthropic has no embeddings — always reroute
  if (cfg.provider === "anthropic" && ep === "anthropic") {
    console.warn(
      "[factory] Anthropic selected as embedProvider — falling back to " +
      "OllamaProvider(nomic-embed-text). Set embedProvider='openai' to use OpenAI embeddings."
    );
    return new OllamaProvider(
      cfg.embedModel ?? "nomic-embed-text",
      cfg.ollamaUrl
    );
  }

  switch (ep) {
    case "ollama":
      return new OllamaProvider(
        cfg.embedModel ?? "nomic-embed-text",
        cfg.ollamaUrl
      );

    case "openai":
      if (!cfg.userId) {
        throw new ProviderError("openai", "userId is required for OpenAI embeddings");
      }
      return new OpenAIProvider(
        cfg.model,
        cfg.userId,
        cfg.embedModel ?? "text-embedding-3-small"
      );

    case "anthropic":
      // Should have been caught above, but handle defensively
      return new OllamaProvider(
        cfg.embedModel ?? "nomic-embed-text",
        cfg.ollamaUrl
      );

    default:
      throw new ProviderError(
        "unknown",
        `Unknown embedProvider: ${String(ep)}. Use 'ollama' or 'openai'.`
      );
  }
}

// ── Quick provider test ───────────────────────────────────────────────────────

/**
 * Sends a minimal completion to verify the provider is reachable.
 * Used by GET /settings/test.
 * Returns latency in ms.
 */
export async function testProvider(
  cfg: ProviderFactoryConfig
): Promise<{ ok: boolean; latencyMs: number; model: string; error?: string }> {
  const start = Date.now();
  try {
    const llm = getLLMProvider(cfg);
    await llm.complete("Reply with exactly: OK", "You are a test assistant. Reply only with what is requested.");
    return { ok: true, latencyMs: Date.now() - start, model: cfg.model };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      model: cfg.model,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
