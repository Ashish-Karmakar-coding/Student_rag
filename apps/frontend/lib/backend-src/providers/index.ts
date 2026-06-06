/**
 * apps/backend/src/providers/index.ts
 * Barrel export for the providers layer.
 */

export type { LLMProvider, EmbeddingProvider, FullProvider } from "./base";
export { ProviderError, ProviderTimeoutError, ProviderAuthError } from "./base";

export { OllamaProvider } from "./ollama";
export { OpenAIProvider } from "./openai";
export { AnthropicProvider } from "./anthropic";

export {
  getLLMProvider,
  getEmbeddingProvider,
  testProvider,
  type ProviderFactoryConfig,
} from "./factory";

export {
  saveApiKey,
  getApiKey,
  deleteApiKey,
  hasApiKey,
} from "./keychain";
