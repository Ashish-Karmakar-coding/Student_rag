/**
 * apps/frontend/lib/useStream.ts
 *
 * React hook for the chat SSE stream.
 *
 * TWO PATHS depending on provider:
 *
 * ── Cloud providers (OpenAI / Anthropic) ───────────────────────────────────
 *   browser → POST /api/backend/chat → Vercel backend → OpenAI/Anthropic → SSE
 *   (unchanged — same as before)
 *
 * ── Local Ollama (Codexa approach) ─────────────────────────────────────────
 *   Step 1: browser → POST /api/backend/chat/retrieve → Pinecone (cloud ✓)
 *   Step 2: browser → POST /api/ollama/generate → localhost:11434 (local ✓)
 *   The LLM call never touches Vercel — it goes browser → your machine.
 *
 * This is exactly how Codexa connects to local Ollama.
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { useAppStore } from "./store";
import { useSettings } from "./useSettings";
import { ollamaStream } from "./useOllama";
import type { SSEEvent, Source } from "@study-tutor/shared";

const BASE = "/api/backend";

interface UseStreamOptions {
  onDone?: (text: string, conceptTags: string[], sources: Source[]) => void;
  onError?: (msg: string) => void;
}

interface StreamState {
  isStreaming: boolean;
  text: string;
  conceptTags: string[];
  sources: Source[];
  masteryHint: { weakConcept: string; score: number } | null;
  error: string | null;
}

export function useStream(opts: UseStreamOptions = {}) {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    text: "",
    conceptTags: [],
    sources: [],
    masteryHint: null,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const addMessage = useAppStore((s) => s.addMessage);
  const updateLastMessage = useAppStore((s) => s.updateLastMessage);
  const { settings } = useSettings();

  // ── Ollama path ─────────────────────────────────────────────────────────────

  const startStreamOllama = useCallback(
    async (query: string, mode: "explain" | "quiz" = "explain") => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      addMessage({ role: "user", text: query, isStreaming: false, conceptTags: [], sources: [], timestamp: new Date().toISOString() });
      addMessage({ role: "assistant", text: "", isStreaming: true, conceptTags: [], sources: [], timestamp: new Date().toISOString() });

      setState({ isStreaming: true, text: "", conceptTags: [], sources: [], masteryHint: null, error: null });

      let accumulated = "";
      let finalConceptTags: string[] = [];
      let finalSources: Source[] = [];

      try {
        // Step 1 — Retrieve context from Pinecone via Vercel backend
        const retrieveRes = await fetch(`${BASE}/chat/retrieve`, {
          method: "POST",
          credentials: "include",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, mode }),
        });

        if (!retrieveRes.ok) {
          const err = await retrieveRes.json().catch(() => ({ error: "Retrieval failed" }));
          throw new Error((err as any).error ?? "Retrieval failed");
        }

        const { chunks, masteryHint } = await retrieveRes.json() as {
          chunks: Array<{
            text: string;
            fileName: string;
            chunkIndex: number;
            page?: number;
            conceptTags: string[];
            subject: string;
          }>;
          masteryHint: { concept: string; score: number } | null;
        };

        // Build source list and concept tags from retrieved chunks
        finalSources = chunks.map((ch) => ({
          fileName: ch.fileName,
          chunkIndex: ch.chunkIndex,
          page: ch.page,
        }));

        finalConceptTags = [...new Set(chunks.flatMap((ch) => ch.conceptTags))];

        // Step 2 — Build prompt with context and stream from local Ollama
        const contextText = chunks
          .slice(0, 6)
          .map((ch, i) => `[${i + 1}] ${ch.text}`)
          .join("\n\n---\n\n");

        const system =
          mode === "quiz"
            ? `You are a Socratic tutor. Help the student discover knowledge through guided questions. Use the context provided. Never give direct answers — ask guiding questions instead.`
            : `You are a helpful study tutor. Use the provided context to explain concepts clearly. Be concise and educational.`;

        const prompt =
          mode === "explain"
            ? `Context from study materials:\n${contextText}\n\n---\n\nStudent question: ${query}\n\nAnswer using the context above:`
            : `Context from study materials:\n${contextText}\n\n---\n\nStudent question: ${query}\n\nAsk ONE Socratic guiding question to help the student think through this:`;

        const model = settings?.model ?? "llama3";

        // Stream tokens from local Ollama
        for await (const token of ollamaStream(prompt, system, model)) {
          if (ctrl.signal.aborted) break;
          accumulated += token;
          updateLastMessage({ text: accumulated });
          setState((prev) => ({ ...prev, text: accumulated }));
        }

        // Emit sources and mastery hint after streaming
        updateLastMessage({ sources: finalSources, conceptTags: finalConceptTags, isStreaming: false });
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          sources: finalSources,
          conceptTags: finalConceptTags,
          masteryHint: masteryHint ? { weakConcept: masteryHint.concept, score: masteryHint.score } : null,
        }));

        opts.onDone?.(accumulated, finalConceptTags, finalSources);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setState((prev) => ({ ...prev, isStreaming: false }));
          return;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({ ...prev, isStreaming: false, error: message }));
        updateLastMessage({ isStreaming: false, text: `⚠️ ${message}` });
        opts.onError?.(message);
      }
    },
    [addMessage, updateLastMessage, settings, opts]
  );

  // ── Cloud path (OpenAI / Anthropic — unchanged) ───────────────────────────

  const startStreamCloud = useCallback(
    async (query: string, mode: "explain" | "quiz" = "explain") => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      addMessage({ role: "user", text: query, isStreaming: false, conceptTags: [], sources: [], timestamp: new Date().toISOString() });
      addMessage({ role: "assistant", text: "", isStreaming: true, conceptTags: [], sources: [], timestamp: new Date().toISOString() });

      let finalConceptTags: string[] = [];
      let finalSources: Source[] = [];

      setState({ isStreaming: true, text: "", conceptTags: [], sources: [], masteryHint: null, error: null });

      let accumulated = "";

      try {
        const res = await fetch(`${BASE}/chat`, {
          method: "POST",
          credentials: "include",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, mode }),
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "Stream failed" }));
          throw new Error((err as { error?: string }).error ?? "Stream failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const jsonStr = trimmed.slice(6);
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr) as SSEEvent;

              if (event.type === "chunk" && "text" in event) {
                accumulated += event.text;
                updateLastMessage({ text: accumulated });
                setState((prev) => ({ ...prev, text: accumulated }));
              } else if (event.type === "concept_tags" && "tags" in event) {
                finalConceptTags = event.tags;
                setState((prev) => ({ ...prev, conceptTags: event.tags }));
                updateLastMessage({ conceptTags: event.tags });
              } else if (event.type === "sources" && "chunks" in event) {
                finalSources = event.chunks;
                setState((prev) => ({ ...prev, sources: event.chunks }));
                updateLastMessage({ sources: event.chunks, isStreaming: false });
              } else if (event.type === "mastery_hint" && "weakConcept" in event) {
                setState((prev) => ({
                  ...prev,
                  masteryHint: { weakConcept: event.weakConcept, score: event.score },
                }));
              } else if (event.type === "done") {
                break;
              } else if (event.type === "error" && "message" in event) {
                throw new Error(event.message);
              }
            } catch (parseErr) {
              // Ignore malformed SSE lines
            }
          }
        }

        setState((prev) => ({ ...prev, isStreaming: false }));
        opts.onDone?.(accumulated, finalConceptTags, finalSources);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setState((prev) => ({ ...prev, isStreaming: false }));
          return;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({ ...prev, isStreaming: false, error: message }));
        updateLastMessage({ isStreaming: false, text: `⚠️ ${message}` });
        opts.onError?.(message);
      }
    },
    [addMessage, updateLastMessage, opts]
  );

  // ── Public API: auto-route by provider ───────────────────────────────────

  const startStream = useCallback(
    (query: string, mode: "explain" | "quiz" = "explain") => {
      if (settings?.provider === "ollama") {
        return startStreamOllama(query, mode);
      }
      return startStreamCloud(query, mode);
    },
    [settings?.provider, startStreamOllama, startStreamCloud]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isStreaming: false }));
    updateLastMessage({ isStreaming: false });
  }, [updateLastMessage]);

  return { ...state, startStream, stop };
}