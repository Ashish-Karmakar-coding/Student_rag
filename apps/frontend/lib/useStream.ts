/**
 * apps/frontend/lib/useStream.ts
 *
 * React hook for consuming the POST /chat SSE stream.
 *
 * Uses fetch() + ReadableStream — not EventSource — because:
 *   - EventSource only supports GET
 *   - We need to POST the query body
 *
 * Protocol: NDJSON lines prefixed with "data: " (standard SSE)
 *
 * Events emitted by the backend:
 *   { type: "chunk",        text: string }
 *   { type: "concept_tags", tags: string[] }
 *   { type: "sources",      chunks: Source[] }
 *   { type: "mastery_hint", weakConcept: string, score: number }
 *   { type: "done" }
 *   { type: "error",        message: string }
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { useAppStore } from "./store";
import type { SSEEvent, Source } from "@study-tutor/shared";


// SSE streaming must use fetch() — Axios does not support streaming responses.
// Use the Next.js proxy rewrite to avoid cross-domain cookie issues in production.
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

  const startStream = useCallback(
    async (query: string, mode: "explain" | "quiz" = "explain") => {
      // Cancel any running stream
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Add a placeholder streaming message to the store
      addMessage({ role: "user", text: query, isStreaming: false, conceptTags: [], sources: [], timestamp: new Date().toISOString() });
      addMessage({ role: "assistant", text: "", isStreaming: true, conceptTags: [], sources: [], timestamp: new Date().toISOString() });

      setState({
        isStreaming: true,
        text: "",
        conceptTags: [],
        sources: [],
        masteryHint: null,
        error: null,
      });

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
                setState((prev) => ({ ...prev, conceptTags: event.tags }));
                updateLastMessage({ conceptTags: event.tags });
              } else if (event.type === "sources" && "chunks" in event) {
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
        opts.onDone?.(accumulated, state.conceptTags, state.sources);
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
    [addMessage, updateLastMessage, opts, state.conceptTags, state.sources]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  return { ...state, startStream, stop };
}