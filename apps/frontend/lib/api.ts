/**
 * apps/frontend/lib/api.ts
 *
 * Type-safe Axios-based API client for the Hono backend.
 *
 * CORS is handled by Axios via `withCredentials: true` on every request,
 * which sends the access_token cookie to the backend automatically.
 *
 * NEXT_PUBLIC_API_URL must be set in Vercel environment variables:
 *   - Local dev: http://localhost:8000
 *   - Production: https://<your-backend-url>
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

// ── Axios instance ─────────────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL: BASE,
  withCredentials: true, // send cookies (access_token) on every request
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request interceptor — attach Authorization header if available ─────────────

apiClient.interceptors.request.use(
  (config) => {
    // NextAuth session token is stored as a cookie — withCredentials handles it.
    // If you later add a bearer token flow, set it here:
    // const token = getToken();
    // if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — unwrap data, normalise errors ─────────────────────

apiClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message =
      err.response?.data?.error ??
      err.response?.data?.message ??
      err.message ??
      "API Error";
    return Promise.reject(new Error(message));
  }
);

// ── Generic request helper ────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const method = (init?.method ?? "GET") as string;
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

  // Use apiClient directly for multipart — don't set Content-Type manually
  // (Axios sets it with the correct boundary automatically for FormData)
  return apiClient.post<any, { jobId: string; fileCount: number; skipped: string[] }>(
    "/upload",
    form,
    {
      headers: {
        // Let Axios handle Content-Type boundary for FormData
        "Content-Type": undefined,
      },
    }
  );
}

export function getIngestStatus(jobId: string): Promise<IngestStatusResponse> {
  return apiFetch(`/ingest-status/${jobId}`);
}

export interface FileInfo {
  fileName: string;
  concepts: string[];
  subject: string;
  uploadedAt: string;
}

export function getFiles(): Promise<FileInfo[]> {
  return apiFetch("/files");
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
  fileName?: string;
}): Promise<QuizNextResponse> {
  const qs = new URLSearchParams();
  if (params?.concept) qs.set("concept", params.concept);
  if (params?.subject) qs.set("subject", params.subject);
  if (params?.fileName) qs.set("fileName", params.fileName);
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