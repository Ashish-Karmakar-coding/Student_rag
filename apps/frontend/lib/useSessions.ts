/**
 * apps/frontend/lib/useSessions.ts
 *
 * Zustand-backed hook for session list data.
 * Mirrors the pattern used in useFiles.ts and useMastery.ts.
 */

"use client";

import { useEffect } from "react";
import { useAppStore } from "./store";
import { getSessions, getSession, deleteSession } from "./api";
import type { SessionDetail } from "@study-tutor/shared";

// ── Sessions hook ─────────────────────────────────────────────────────────────

export function useSessions() {
  const sessionList = useAppStore((s) => s.sessionList);
  const sessionsLoading = useAppStore((s) => s.sessionsLoading);
  const sessionsError = useAppStore((s) => s.sessionsError);
  const sessionsFetched = useAppStore((s) => s.sessionsFetched);
  const setSessionList = useAppStore((s) => s.setSessionList);
  const setSessionsLoading = useAppStore((s) => s.setSessionsLoading);
  const setSessionsError = useAppStore((s) => s.setSessionsError);
  const setSessionsFetched = useAppStore((s) => s.setSessionsFetched);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const data = await getSessions();
      setSessionList(data);
      setSessionsFetched(true);
    } catch (err: any) {
      setSessionsError(err?.message ?? "Failed to load sessions");
      setSessionsFetched(true);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionsFetched && !sessionsLoading) {
      fetchSessions();
    }
  }, [sessionsFetched, sessionsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    sessions: sessionList,
    isLoading: sessionsLoading,
    error: sessionsError,
    revalidate: fetchSessions,
  };
}

// ── Fetch a single session ────────────────────────────────────────────────────

export function useSession(id: string | null) {
  const selectedSession = useAppStore((s) => s.selectedSession);
  const setSelectedSession = useAppStore((s) => s.setSelectedSession);

  useEffect(() => {
    if (!id) {
      setSelectedSession(null);
      return;
    }
    // Only refetch if we don't already have this session loaded
    if (selectedSession?.id === id) return;

    getSession(id)
      .then(setSelectedSession)
      .catch(() => setSelectedSession(null));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { session: selectedSession };
}

// ── Delete helper ─────────────────────────────────────────────────────────────

export async function removeSession(id: string): Promise<void> {
  const store = useAppStore.getState();
  // Optimistic removal — remove from store immediately
  store.removeSession(id);
  // Then call API
  await deleteSession(id);
}

// ── Revalidate from anywhere (e.g. after a chat session ends) ─────────────────

export async function invalidateSessions(): Promise<void> {
  const store = useAppStore.getState();
  store.setSessionsFetched(false);
}
