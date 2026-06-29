/**
 * packages/shared/src/schemas.ts
 *
 * Zod schemas for all request/response validation.
 * Used on the backend (Hono) and frontend (react-hook-form + zod resolver).
 * Schemas are derived from the types in types.ts — single source of truth.
 */

import { z } from "zod";

// ── Provider ──────────────────────────────────────────────────────────────────

export const ProviderSchema = z.enum(["ollama", "openai", "anthropic"]);

export const EmbedProviderSchema = z.enum(["ollama", "openai", "pinecone"]);

export const ChatModeSchema = z.enum(["explain", "quiz"]);

export const QuizDifficultySchema = z.enum([
  "foundational",
  "intermediate",
  "advanced",
]);

// ── Provider Config ───────────────────────────────────────────────────────────

export const ProviderConfigSchema = z.object({
  provider: ProviderSchema,
  model: z.string().min(1, "Model name is required"),
  ollamaUrl: z.string().url("Must be a valid URL").optional(),
  // embedProvider and embedModel are now managed by the server (always Pinecone)
  embedProvider: EmbedProviderSchema.optional(),
  embedModel: z.string().optional(),
  keyStored: z.boolean().optional(),
});

export type ProviderConfigInput = z.infer<typeof ProviderConfigSchema>;

// ── Auth ──────────────────────────────────────────────────────────────────────

export const SyncUserSchema = z.object({
  githubId: z.string().min(1),
  login: z.string().min(1),
  avatarUrl: z.string(),
  email: z.string().nullable().optional(),
});

export type SyncUserInput = z.infer<typeof SyncUserSchema>;

// ── Chat ──────────────────────────────────────────────────────────────────────

export const ChatRequestSchema = z.object({
  query: z
    .string()
    .min(1, "Query cannot be empty")
    .max(2000, "Query is too long (max 2000 chars)"),
  mode: ChatModeSchema,
  subject: z.string().max(100).optional(),
});

export type ChatRequestInput = z.infer<typeof ChatRequestSchema>;

// ── Quiz ──────────────────────────────────────────────────────────────────────

export const QuizAnswerSchema = z.object({
  questionId: z.string().uuid("Invalid question ID"),
  answer: z
    .string()
    .min(1, "Answer cannot be empty")
    .max(5000, "Answer is too long (max 5000 chars)"),
});

export type QuizAnswerInput = z.infer<typeof QuizAnswerSchema>;

export const QuizNextQuerySchema = z.object({
  concept: z.string().optional(),
  subject: z.string().optional(),
  fileName: z.string().optional(),
});

export type QuizNextQueryInput = z.infer<typeof QuizNextQuerySchema>;

// ── Settings ──────────────────────────────────────────────────────────────────

export const PatchSettingsSchema = z.object({
  providerConfig: ProviderConfigSchema,
});

export type PatchSettingsInput = z.infer<typeof PatchSettingsSchema>;

export const SaveApiKeySchema = z.object({
  provider: ProviderSchema,
  apiKey: z.string().min(8, "API key is too short"),
});

export type SaveApiKeyInput = z.infer<typeof SaveApiKeySchema>;

// ── Ingest ────────────────────────────────────────────────────────────────────

export const IngestStatusParamsSchema = z.object({
  jobId: z.string().uuid("Invalid job ID"),
});

export type IngestStatusParamsInput = z.infer<typeof IngestStatusParamsSchema>;

export const DeleteUploadParamsSchema = z.object({
  fileName: z.string().min(1),
});

export type DeleteUploadParamsInput = z.infer<typeof DeleteUploadParamsSchema>;

// ── Mastery ───────────────────────────────────────────────────────────────────

export const MasteryResetParamsSchema = z.object({
  concept: z.string().min(1),
});

export type MasteryResetParamsInput = z.infer<typeof MasteryResetParamsSchema>;

// ── Sessions ──────────────────────────────────────────────────────────────────

export const SessionIdParamsSchema = z.object({
  id: z.string().min(1),
});

export type SessionIdParamsInput = z.infer<typeof SessionIdParamsSchema>;

// ── File upload validation ────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/markdown",
  "text/plain", // .md files sometimes sent as text/plain
] as const;

export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".md", ".txt"] as const;

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// ── LLM Evaluation response ───────────────────────────────────────────────────

/**
 * Shape the LLM must return when evaluating a quiz answer.
 * Backend uses this to parse the raw JSON string from the LLM.
 */
export const EvalResultSchema = z.object({
  score: z.number().min(0).max(1),
  feedback: z.string(),
  explanation: z.string(),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;

// ── Concept tag extraction ────────────────────────────────────────────────────

/**
 * Shape returned by the concept tagger LLM call.
 * Array of 2-5 lowercase strings.
 */
export const ConceptTagArraySchema = z
  .array(z.string().toLowerCase())
  .min(1)
  .max(10);

export type ConceptTagArray = z.infer<typeof ConceptTagArraySchema>;
