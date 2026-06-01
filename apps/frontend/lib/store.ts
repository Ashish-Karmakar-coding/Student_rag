/**
 * apps/frontend/lib/store.ts
 *
 * Zustand global store for client-side state.
 *
 * Slices:
 *   messages   — chat message list for the current session
 *   ui         — sidebar open/closed, active mode, active session id
 *   upload     — upload progress and ingest job tracking
 */

"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Source } from "@study-tutor/shared";

// ── Message type ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  isStreaming: boolean;
  conceptTags: string[];
  sources: Source[];
  timestamp: string;
}

// ── Upload tracking ───────────────────────────────────────────────────────────

export interface UploadJob {
  jobId: string;
  fileNames: string[];
  status: "queued" | "processing" | "done" | "error";
  progress: number;
}

// ── Store shape ───────────────────────────────────────────────────────────────

interface AppState {
  // ── Chat ──────────────────────────────────────────────────────────────────
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  updateLastMessage: (patch: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  setMessages: (msgs: ChatMessage[]) => void;

  // ── UI ────────────────────────────────────────────────────────────────────
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  activeMode: "explain" | "quiz";
  setActiveMode: (mode: "explain" | "quiz") => void;

  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  // ── Upload ────────────────────────────────────────────────────────────────
  currentJob: UploadJob | null;
  setCurrentJob: (job: UploadJob | null) => void;
  updateJobStatus: (patch: Partial<UploadJob>) => void;
}

// ── Store implementation ──────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      // ── Chat ────────────────────────────────────────────────────────────
      messages: [],

      addMessage: (msg) =>
        set((state) => ({
          messages: [...state.messages, msg],
        })),

      updateLastMessage: (patch) =>
        set((state) => {
          if (state.messages.length === 0) return state;
          const messages = [...state.messages];
          const last = messages[messages.length - 1];
          if (last) {
            messages[messages.length - 1] = { ...last, ...patch };
          }
          return { messages };
        }),

      clearMessages: () => set({ messages: [] }),

      setMessages: (msgs) => set({ messages: msgs }),

      // ── UI ───────────────────────────────────────────────────────────────
      sidebarOpen: true,

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      activeMode: "explain",

      setActiveMode: (mode) => set({ activeMode: mode }),

      activeSessionId: null,

      setActiveSessionId: (id) => set({ activeSessionId: id }),

      // ── Upload ────────────────────────────────────────────────────────────
      currentJob: null,

      setCurrentJob: (job) => set({ currentJob: job }),

      updateJobStatus: (patch) =>
        set((state) => ({
          currentJob: state.currentJob ? { ...state.currentJob, ...patch } : null,
        })),
    }),
    { name: "study-tutor" }
  )
);
