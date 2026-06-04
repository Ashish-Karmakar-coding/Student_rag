/**
 * apps/frontend/lib/api.ts
 *
 * Type-safe API client for the Hono backend.
 * All functions use credentials: "include" so the access_token cookie is sent.
 *
 * NEXT_PUBLIC_API_URL defaults to http://localhost:8000 for local development.
 */

import type {
  MasteryDoc,
  MasterySummary,
  SessionListItem,
  SessionDetail,
  ProviderConfig,
  IngestStatusResponse,
  QuizNextResponse,
  QuizAnswerResponse,
} from "@study-tutor/shared";

import axios from "axios";

const BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";

const apiClient = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error ?? err.message ?? "API Error";
    return Promise.reject(new Error(message));
  }
);

// ── Generic fetch wrapper ─────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  const data = init?.body ? JSON.parse(init.body as string) : undefined;
  
  return apiClient.request<any, T>({
    url: path,
    method,
    data,
    headers: init?.headers as any,
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function getSettings(): Promise<ProviderConfig & { keyStored: boolean }> {
  return apiFetch("/settings");
}

export function patchSettings(data: {
  providerConfig: {
    provider: string;
    model: string;
    ollamaUrl?: string;
    embedProvider?: string;
    embedModel?: string;
  };
}): Promise<{ ok: boolean }> {
  return apiFetch("/settings", { method: "PATCH", body: JSON.stringify(data) });
}

export function saveApiKey(provider: string, apiKey: string): Promise<{ ok: boolean }> {
  return apiFetch("/settings/api-key", {
    method: "POST",
    body: JSON.stringify({ provider, apiKey }),
  });
}

export function deleteApiKey(provider: string): Promise<{ ok: boolean }> {
  return apiFetch("/settings/api-key", {
    method: "DELETE",
    body: JSON.stringify({ provider }),
  });
}

export function testProvider(): Promise<{
  ok: boolean;
  latencyMs: number;
  model: string;
  error?: string;
}> {
  return apiFetch("/settings/test");
}

// ── Ingest ────────────────────────────────────────────────────────────────────

export async function uploadFiles(
  files: File[]
): Promise<{ jobId: string; fileCount: number; skipped: string[] }> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));

  try {
    const data = await apiClient.post<any, { jobId: string; fileCount: number; skipped: string[] }>("/upload", form, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return data;
  } catch (err: any) {
    const message = err.response?.data?.error ?? err.message ?? "Upload failed";
    throw new Error(message);
  }
}

export function getIngestStatus(jobId: string): Promise<IngestStatusResponse> {
  return apiFetch(`/ingest-status/${jobId}`);
}

export function deleteFile(fileName: string): Promise<{ ok: boolean }> {
  return apiFetch(`/upload/${encodeURIComponent(fileName)}`, { method: "DELETE" });
}

// ── Mastery ───────────────────────────────────────────────────────────────────

export function getMastery(): Promise<MasteryDoc[]> {
  return apiFetch("/mastery");
}

export function getMasterySummary(): Promise<MasterySummary> {
  return apiFetch("/mastery/summary");
}

export function resetConcept(concept: string): Promise<{ ok: boolean; resetTo: number }> {
  return apiFetch(`/mastery/${encodeURIComponent(concept)}/reset`, {
    method: "PATCH",
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function getSessions(): Promise<SessionListItem[]> {
  return apiFetch("/sessions");
}

export function getSession(id: string): Promise<SessionDetail> {
  return apiFetch(`/sessions/${id}`);
}

export function deleteSession(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/sessions/${id}`, { method: "DELETE" });
}

// ── Quiz ──────────────────────────────────────────────────────────────────────

export function getNextQuestion(params?: {
  concept?: string;
  subject?: string;
}): Promise<QuizNextResponse> {
  const qs = new URLSearchParams();
  if (params?.concept) qs.set("concept", params.concept);
  if (params?.subject) qs.set("subject", params.subject);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/quiz/next${query}`);
}

export function submitAnswer(
  questionId: string,
  answer: string
): Promise<QuizAnswerResponse> {
  return apiFetch("/quiz/answer", {
    method: "POST",
    body: JSON.stringify({ questionId, answer }),
  });
}

// ── Health ────────────────────────────────────────────────────────────────────

export function getHealth(): Promise<{
  mongo: string;
  pinecone: string;
  cohere: string;
  uptime: number;
  timestamp: string;
}> {
  return apiFetch("/health");
}
