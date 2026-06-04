/**
 * apps/frontend/lib/useMastery.ts
 *
 * Zustand hooks for mastery data.
 * Provides auto-revalidation (refreshes after quiz answers).
 */

"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { getMastery, getMasterySummary } from "./api";
import type { MasteryDoc, MasterySummary } from "@study-tutor/shared";

interface MasteryState {
  mastery: MasteryDoc[];
  masteryLoading: boolean;
  masteryError: any;
  summary: MasterySummary;
  summaryLoading: boolean;
  summaryError: any;
  masteryFetched: boolean;
  summaryFetched: boolean;
  fetchMastery: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  invalidate: () => Promise<void>;
}

const defaultSummary: MasterySummary = {
  overallPct: 0,
  masteredCount: 0,
  weakCount: 0,
  totalCount: 0,
  sessionsThisWeek: 0,
  streakDays: 0,
};

export const useMasteryStore = create<MasteryState>((set, get) => ({
  mastery: [],
  masteryLoading: false,
  masteryError: null,
  masteryFetched: false,
  
  summary: defaultSummary,
  summaryLoading: false,
  summaryError: null,
  summaryFetched: false,
  
  fetchMastery: async () => {
    set({ masteryLoading: true, masteryError: null });
    try {
      const data = await getMastery();
      set({ mastery: data, masteryLoading: false, masteryFetched: true });
    } catch (err) {
      set({ masteryError: err, masteryLoading: false, masteryFetched: true });
    }
  },
  
  fetchSummary: async () => {
    set({ summaryLoading: true, summaryError: null });
    try {
      const data = await getMasterySummary();
      set({ summary: data, summaryLoading: false, summaryFetched: true });
    } catch (err) {
      set({ summaryError: err, summaryLoading: false, summaryFetched: true });
    }
  },

  invalidate: async () => {
    await Promise.all([
      get().fetchMastery(),
      get().fetchSummary()
    ]);
  }
}));

// ── All concepts hook ─────────────────────────────────────────────────────────

export function useMastery() {
  const { mastery, masteryLoading, masteryError, masteryFetched, fetchMastery } = useMasteryStore();
  
  useEffect(() => {
    if (!masteryFetched && !masteryLoading) {
      fetchMastery();
    }
  }, [masteryFetched, masteryLoading, fetchMastery]);

  return {
    mastery,
    isLoading: masteryLoading,
    error: masteryError,
    revalidate: fetchMastery,
  };
}

// ── Summary hook ──────────────────────────────────────────────────────────────

export function useMasterySummary() {
  const { summary, summaryLoading, summaryError, fetchSummary } = useMasteryStore();
  
  useEffect(() => {
    fetchSummary();
    const interval = setInterval(() => {
      fetchSummary();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  return {
    summary,
    isLoading: summaryLoading,
    error: summaryError,
  };
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Call after a quiz answer to refresh mastery data globally. */
export async function invalidateMastery() {
  await useMasteryStore.getState().invalidate();
}

/** Get color for a mastery score (used by bars, dots, etc.). */
export function getMasteryColor(score: number): string {
  if (score >= 0.7) return "#22c55e"; // green
  if (score >= 0.45) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

/** Get label for a mastery score tier. */
export function getMasteryLabel(score: number): string {
  if (score >= 0.7) return "Mastered";
  if (score >= 0.45) return "Learning";
  return "Weak";
}

/** Returns concepts sorted by score ascending (weakest first). */
export function getWeakConcepts(mastery: MasteryDoc[], limit = 5): MasteryDoc[] {
  return [...mastery]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}
