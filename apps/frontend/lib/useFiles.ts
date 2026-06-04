"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { getFiles, type FileInfo } from "./api";

interface FilesState {
  files: FileInfo[];
  isLoading: boolean;
  error: any;
  hasFetched: boolean;
  fetchFiles: () => Promise<void>;
  invalidate: () => Promise<void>;
}

export const useFilesStore = create<FilesState>((set, get) => ({
  files: [],
  isLoading: false,
  error: null,
  hasFetched: false,

  fetchFiles: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getFiles();
      set({ files: data, isLoading: false, hasFetched: true });
    } catch (err) {
      set({ error: err, isLoading: false, hasFetched: true });
    }
  },

  invalidate: async () => {
    await get().fetchFiles();
  }
}));

export function useFiles() {
  const { files, isLoading, error, hasFetched, fetchFiles } = useFilesStore();

  useEffect(() => {
    if (!hasFetched && !isLoading) {
      fetchFiles();
    }
  }, [hasFetched, isLoading, fetchFiles]);

  return {
    files,
    isLoading,
    error,
    revalidate: fetchFiles,
  };
}

export async function invalidateFiles() {
  await useFilesStore.getState().invalidate();
}
