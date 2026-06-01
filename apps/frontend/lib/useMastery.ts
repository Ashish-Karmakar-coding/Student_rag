/**
 * apps/frontend/lib/useMastery.ts
 *
 * SWR hooks for mastery data.
 * Provides auto-revalidation (refreshes after quiz answers).
 */

"use client";

import useSWR, { mutate } from "swr";
import { getMastery, getMasterySummary } from "./api";
import type { MasteryDoc, MasterySummary } from "@study-tutor/shared";

const MASTERY_KEY = "/mastery";
const SUMMARY_KEY = "/mastery/summary";

// ── All concepts hook ─────────────────────────────────────────────────────────

export function useMastery() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<MasteryDoc[]>(
    MASTERY_KEY,
    getMastery,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10_000,
    }
  );

  return {
    mastery: data ?? [],
    isLoading,
    error,
    revalidate,
  };
}

// ── Summary hook ──────────────────────────────────────────────────────────────

export function useMasterySummary() {
  const { data, error, isLoading } = useSWR<MasterySummary>(
    SUMMARY_KEY,
    getMasterySummary,
    {
      revalidateOnFocus: true,
      refreshInterval: 60_000, // refresh every minute
    }
  );

  return {
    summary: data ?? {
      overallPct: 0,
      masteredCount: 0,
      weakCount: 0,
      totalCount: 0,
      sessionsThisWeek: 0,
      streakDays: 0,
    },
    isLoading,
    error,
  };
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Call after a quiz answer to refresh mastery data globally. */
export async function invalidateMastery() {
  await Promise.all([
    mutate(MASTERY_KEY),
    mutate(SUMMARY_KEY),
  ]);
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
