/**
 * apps/frontend/lib/useSettings.ts
 *
 * Zustand-backed hook for provider settings.
 * Caches the result globally so settings aren't re-fetched on every render.
 */

"use client";

import { useEffect } from "react";
import { useAppStore } from "./store";
import { getSettings, patchSettings, saveApiKey, deleteApiKey, testProvider } from "./api";
import type { SettingsSnapshot } from "./store";

// ── Settings hook ─────────────────────────────────────────────────────────────

export function useSettings() {
  const settings = useAppStore((s) => s.settings);
  const settingsLoading = useAppStore((s) => s.settingsLoading);
  const settingsFetched = useAppStore((s) => s.settingsFetched);
  const setSettings = useAppStore((s) => s.setSettings);
  const setSettingsLoading = useAppStore((s) => s.setSettingsLoading);
  const setSettingsFetched = useAppStore((s) => s.setSettingsFetched);

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const data = await getSettings();
      setSettings(data as SettingsSnapshot);
      setSettingsFetched(true);
    } catch {
      setSettingsFetched(true);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (!settingsFetched && !settingsLoading) {
      fetchSettings();
    }
  }, [settingsFetched, settingsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    settings,
    isLoading: settingsLoading,
    refetch: fetchSettings,
  };
}

// ── Imperative actions (usable from event handlers) ───────────────────────────

export async function applySettings(data: {
  provider: string;
  model: string;
  ollamaUrl?: string;
  embedProvider?: string;
  embedModel?: string;
}): Promise<{ ok: boolean }> {
  const result = await patchSettings({ providerConfig: data });
  // Sync store immediately after save
  useAppStore.getState().patchSettingsLocal(data as Partial<SettingsSnapshot>);
  return result;
}

export async function storeApiKey(provider: string, apiKey: string): Promise<{ ok: boolean }> {
  const result = await saveApiKey(provider, apiKey);
  useAppStore.getState().patchSettingsLocal({ keyStored: true });
  return result;
}

export async function removeApiKey(provider: string): Promise<{ ok: boolean }> {
  const result = await deleteApiKey(provider);
  useAppStore.getState().patchSettingsLocal({ keyStored: false });
  return result;
}

export async function runConnectionTest(): Promise<{
  ok: boolean;
  latencyMs: number;
  model: string;
  error?: string;
}> {
  return testProvider();
}
