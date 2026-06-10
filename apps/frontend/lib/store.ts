/**
 * apps/frontend/lib/store.ts
 *
 * Zustand global store for client-side state.
 *
 * Slices:
 *   messages   — chat message list for the current session
 *   ui         — sidebar open/closed, active mode, active session id
 *   upload     — upload progress and ingest job tracking
 *   sessions   — session list + selected session detail
 *   quiz       — current question, answer, result, phase
 *   settings   — provider config + key status (cached, avoids re-fetching)
 */

"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Source, SessionListItem, SessionDetail, ProviderConfig } from "@study-tutor/shared";

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

// ── Settings snapshot ─────────────────────────────────────────────────────────

export interface SettingsSnapshot extends ProviderConfig {
  keyStored: boolean;
}

// ── Quiz types ────────────────────────────────────────────────────────────────

export type QuizPhase =
  | "idle"
  | "loading-q"
  | "question"
  | "answering"
  | "evaluating"
  | "result";

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

  // ── Sessions ──────────────────────────────────────────────────────────────
  sessionList: SessionListItem[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  sessionsFetched: boolean;
  selectedSession: SessionDetail | null;
  setSessionList: (list: SessionListItem[]) => void;
  setSessionsLoading: (v: boolean) => void;
  setSessionsError: (err: string | null) => void;
  setSessionsFetched: (v: boolean) => void;
  setSelectedSession: (session: SessionDetail | null) => void;
  removeSession: (id: string) => void;

  // ── Quiz ──────────────────────────────────────────────────────────────────
  quizPhase: QuizPhase;
  quizSelectedFile: string;
  setQuizPhase: (phase: QuizPhase) => void;
  setQuizSelectedFile: (file: string) => void;
  resetQuiz: () => void;

  // ── Settings ─────────────────────────────────────────────────────────────
  settings: SettingsSnapshot | null;
  settingsLoading: boolean;
  settingsFetched: boolean;
  setSettings: (s: SettingsSnapshot | null) => void;
  setSettingsLoading: (v: boolean) => void;
  setSettingsFetched: (v: boolean) => void;
  patchSettingsLocal: (patch: Partial<SettingsSnapshot>) => void;
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

      // ── Sessions ──────────────────────────────────────────────────────────
      sessionList: [],
      sessionsLoading: false,
      sessionsError: null,
      sessionsFetched: false,
      selectedSession: null,

      setSessionList: (list) => set({ sessionList: list }),
      setSessionsLoading: (v) => set({ sessionsLoading: v }),
      setSessionsError: (err) => set({ sessionsError: err }),
      setSessionsFetched: (v) => set({ sessionsFetched: v }),
      setSelectedSession: (session) => set({ selectedSession: session }),

      removeSession: (id) =>
        set((state) => ({
          sessionList: state.sessionList.filter((s) => s.id !== id),
          selectedSession:
            state.selectedSession?.id === id ? null : state.selectedSession,
          activeSessionId:
            state.activeSessionId === id ? null : state.activeSessionId,
        })),

      // ── Quiz ──────────────────────────────────────────────────────────────
      quizPhase: "idle",
      quizSelectedFile: "",

      setQuizPhase: (phase) => set({ quizPhase: phase }),
      setQuizSelectedFile: (file) => set({ quizSelectedFile: file }),
      resetQuiz: () => set({ quizPhase: "idle", quizSelectedFile: "" }),

      // ── Settings ─────────────────────────────────────────────────────────
      settings: null,
      settingsLoading: false,
      settingsFetched: false,

      setSettings: (s) => set({ settings: s }),
      setSettingsLoading: (v) => set({ settingsLoading: v }),
      setSettingsFetched: (v) => set({ settingsFetched: v }),
      patchSettingsLocal: (patch) =>
        set((state) => ({
          settings: state.settings ? { ...state.settings, ...patch } : null,
        })),
    }),
    { name: "study-tutor" }
  )
);

// ── Selector hooks (convenience) ──────────────────────────────────────────────

/** Select just the chat slice */
export const useChatStore = () =>
  useAppStore((s) => ({
    messages: s.messages,
    addMessage: s.addMessage,
    updateLastMessage: s.updateLastMessage,
    clearMessages: s.clearMessages,
    setMessages: s.setMessages,
  }));

/** Select just the sessions slice */
export const useSessionsStore = () =>
  useAppStore((s) => ({
    sessionList: s.sessionList,
    sessionsLoading: s.sessionsLoading,
    sessionsError: s.sessionsError,
    sessionsFetched: s.sessionsFetched,
    selectedSession: s.selectedSession,
    setSessionList: s.setSessionList,
    setSessionsLoading: s.setSessionsLoading,
    setSessionsError: s.setSessionsError,
    setSessionsFetched: s.setSessionsFetched,
    setSelectedSession: s.setSelectedSession,
    removeSession: s.removeSession,
  }));

/** Select just the settings slice */
export const useSettingsStore = () =>
  useAppStore((s) => ({
    settings: s.settings,
    settingsLoading: s.settingsLoading,
    settingsFetched: s.settingsFetched,
    setSettings: s.setSettings,
    setSettingsLoading: s.setSettingsLoading,
    setSettingsFetched: s.setSettingsFetched,
    patchSettingsLocal: s.patchSettingsLocal,
  }));

/** Select just the quiz slice */
export const useQuizStore = () =>
  useAppStore((s) => ({
    quizPhase: s.quizPhase,
    quizSelectedFile: s.quizSelectedFile,
    setQuizPhase: s.setQuizPhase,
    setQuizSelectedFile: s.setQuizSelectedFile,
    resetQuiz: s.resetQuiz,
  }));
