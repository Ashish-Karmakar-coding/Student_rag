/**
 * apps/backend/src/providers/index.ts
 * Barrel export for the providers layer.
 */

export type { LLMProvider, EmbeddingProvider, FullProvider } from "./base.js";
export { ProviderError, ProviderTimeoutError, ProviderAuthError } from "./base.js";

export { OllamaProvider } from "./ollama.js";
export { OpenAIProvider } from "./openai.js";
export { AnthropicProvider } from "./anthropic.js";
export { PineconeEmbeddingProvider } from "./pinecone.js";

export {
  getLLMProvider,
  getEmbeddingProvider,
  getQueryEmbeddingProvider,
  testProvider,
  type ProviderFactoryConfig,
} from "./factory.js";

export {
  saveApiKey,
  getApiKey,
  deleteApiKey,
  hasApiKey,
} from "./keychain.js";
