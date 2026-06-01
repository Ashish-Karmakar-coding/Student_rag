/**
 * packages/shared/src/types.ts
 *
 * All shared TypeScript types used by both backend (Hono) and frontend (Next.js).
 * Zero runtime — pure type declarations. No circular dependencies.
 */

// ── Provider ─────────────────────────────────────────────────────────────────

export type Provider = "ollama" | "openai" | "anthropic";

export type EmbedProvider = "ollama" | "openai";

export type ChatMode = "explain" | "quiz";

export type QuizDifficulty = "foundational" | "intermediate" | "advanced";

export type IngestFileStatus = "queued" | "processing" | "done" | "error";

export type IngestJobStatus = "queued" | "processing" | "done" | "error";

export type MessageRole = "user" | "assistant";

// ── Provider Config ───────────────────────────────────────────────────────────

export interface ProviderConfig {
  provider: Provider;
  model: string;
  /** Only relevant when provider === "ollama" */
  ollamaUrl?: string;
  /** Separate embed provider — Anthropic falls back to ollama */
  embedProvider?: EmbedProvider;
  embedModel?: string;
  /** True when an API key has been saved to the OS keychain */
  keyStored?: boolean;
}

// ── User ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  githubId: string;
  login: string;
  avatarUrl: string;
  email: string | null;
  hasFiles: boolean;
  provider: Provider;
  providerConfig: ProviderConfig;
  createdAt: string;
  lastSeen: string;
}

// ── Source chunk reference ────────────────────────────────────────────────────

export interface Source {
  fileName: string;
  chunkIndex: number;
  page?: number;
}

// ── Chat / Messaging ──────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  conceptTags: string[];
  sources: Source[];
  isStreaming: boolean;
  timestamp: string;
}

export interface ChatRequest {
  query: string;
  mode: ChatMode;
  subject?: string;
}

// ── SSE event shapes (chat stream) ────────────────────────────────────────────

export type SSEEventType =
  | "chunk"
  | "concept_tags"
  | "sources"
  | "mastery_hint"
  | "done"
  | "error";

export interface SSEChunkEvent {
  type: "chunk";
  text: string;
}

export interface SSEConceptTagsEvent {
  type: "concept_tags";
  tags: string[];
}

export interface SSESourcesEvent {
  type: "sources";
  chunks: Source[];
}

export interface SSEMasteryHintEvent {
  type: "mastery_hint";
  weakConcept: string;
  score: number;
}

export interface SSEDoneEvent {
  type: "done";
}

export interface SSEErrorEvent {
  type: "error";
  message: string;
}

export type SSEEvent =
  | SSEChunkEvent
  | SSEConceptTagsEvent
  | SSESourcesEvent
  | SSEMasteryHintEvent
  | SSEDoneEvent
  | SSEErrorEvent;

// ── Ingest ────────────────────────────────────────────────────────────────────

export interface IngestJobFile {
  fileName: string;
  sizeBytes: number;
  status: IngestFileStatus;
  conceptsFound: string[];
  error?: string;
}

export interface IngestStatusResponse {
  jobId: string;
  status: IngestJobStatus;
  progress: number;
  files: IngestJobFile[];
  conceptsFound: string[];
  completedAt: string | null;
}

export interface UploadResponse {
  jobId: string;
}

// ── Mastery ───────────────────────────────────────────────────────────────────

export interface ConceptMastery {
  concept: string;
  subject: string;
  score: number;
  attemptCount: number;
  correctCount: number;
  lastTested: string | null;
  createdAt: string;
}

export interface MasterySummary {
  overallPct: number;
  masteredCount: number;
  weakCount: number;
  totalCount: number;
  sessionsThisWeek: number;
  streakDays: number;
}

// ── Quiz ──────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  questionId: string;
  question: string;
  concept: string;
  masteryBefore: number;
  difficulty: QuizDifficulty;
  hint: string;
  sources: Source[];
}

export interface QuizAnswerRequest {
  questionId: string;
  answer: string;
}

export interface QuizResult {
  score: number;
  feedback: string;
  explanation: string;
  masteryBefore: number;
  masteryAfter: number;
  delta: number;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  subject: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDetail {
  id: string;
  subject: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// ── Settings / Provider ───────────────────────────────────────────────────────

export interface ProviderStatus {
  ok: boolean;
  latencyMs: number;
  model: string;
  error?: string;
}

export interface SaveApiKeyRequest {
  provider: Provider;
  apiKey: string;
}

export interface PatchSettingsRequest {
  providerConfig: ProviderConfig;
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  mongo: "ok" | "error";
  pinecone: "ok" | "error";
  llm: "ok" | "error" | "unconfigured";
  timestamp: string;
  errors?: Record<string, string>;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface OkResponse {
  ok: true;
  message?: string;
}

// ── Frontend-facing alias types (match API response shapes exactly) ───────────

/** Alias for ConceptMastery — used by frontend useMastery hook */
export type MasteryDoc = ConceptMastery;

/** Alias for SessionSummary — used by frontend session list */
export type SessionListItem = SessionSummary;

/** Alias for QuizQuestion — used by frontend quiz page */
export type QuizNextResponse = QuizQuestion;

/** Alias for QuizResult — used by frontend quiz page */
export type QuizAnswerResponse = QuizResult;

/**
 * The full ingest job status object returned by GET /ingest-status/:jobId
 * Matches IngestStatusResponse exactly.
 */
export type IngestJobStatusResponse = IngestStatusResponse;

