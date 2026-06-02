"use client";
/**
 * apps/frontend/app/(app)/upload/page.tsx
 * Drag-and-drop file upload with live job progress polling.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Upload, FileText, Loader2, CheckCircle2,
  XCircle, FolderOpen, Sparkles, X,
} from "lucide-react";
import { uploadFiles, getIngestStatus } from "../../../lib/api";
import type { IngestStatusResponse } from "@study-tutor/shared";

const ALLOWED = [".pdf", ".docx", ".md", ".txt"];
const MAX_MB = 50;

interface FileEntry {
  file: File;
  id: string;
  error?: string;
}

function validate(file: File): string | null {
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  if (!ALLOWED.includes(ext)) return `Unsupported type (${ext})`;
  if (file.size > MAX_MB * 1024 * 1024) return `Too large (>${MAX_MB}MB)`;
  return null;
}

export default function UploadPage() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [job, setJob] = useState<IngestStatusResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Drag handlers ────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  }, []);

  const addFiles = (files: File[]) => {
    const newEntries: FileEntry[] = files.map((f) => ({
      file: f,
      id: `${f.name}-${Date.now()}`,
      error: validate(f) ?? undefined,
    }));
    setEntries((prev) => {
      const names = new Set(prev.map((e) => e.file.name));
      return [...prev, ...newEntries.filter((e) => !names.has(e.file.name))];
    });
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    const valid = entries.filter((e) => !e.error);
    if (!valid.length) { toast.error("No valid files to upload"); return; }

    setUploading(true);
    try {
      const { jobId } = await uploadFiles(valid.map((e) => e.file));
      toast.success("Upload started! Processing your documents…");
      setEntries([]);
      pollJob(jobId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ── Polling ──────────────────────────────────────────────────────────────
  const pollJob = (jobId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await getIngestStatus(jobId);
        setJob(status);
        if (status.status === "done" || status.status === "error") {
          clearInterval(pollRef.current!);
          if (status.status === "done") toast.success("Documents ingested successfully!");
          else toast.error("Some files failed to process");
        }
      } catch { clearInterval(pollRef.current!); }
    }, 2500);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const validCount = entries.filter((e) => !e.error).length;

  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto bg-surface-base text-text-primary font-body-default">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded bg-surface-raised border border-border-default flex items-center justify-center">
            <Upload size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight uppercase">Upload Study Materials</h1>
            <p className="text-xs text-text-muted font-label-mono">PDF, DOCX, or Markdown · Max 50MB per file</p>
          </div>
        </div>
      </motion.div>

      {/* Drop zone */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-200 ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border-default hover:border-primary/40 hover:bg-surface-raised/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.md,.txt"
          className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
        />
        <AnimatePresence mode="wait">
          {dragging ? (
            <motion.div key="dragging" initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <FolderOpen size={36} className="text-primary mx-auto mb-3" />
              <p className="font-semibold text-xs font-label-caps text-primary">Drop to upload</p>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Upload size={32} className="text-text-muted mx-auto mb-3" />
              <p className="font-semibold text-xs text-text-secondary mb-1">Drag files here or click to browse</p>
              <p className="text-[10px] font-label-mono text-text-muted">PDF · DOCX · Markdown · Plain text</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* File list */}
      <AnimatePresence>
        {entries.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="bg-surface-raised border border-border-subtle flex items-center gap-3 px-4 py-3 rounded-lg">
                <FileText size={16} className={entry.error ? "text-error" : "text-primary"} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate text-text-primary">{entry.file.name}</div>
                  {entry.error
                    ? <div className="text-[10px] font-label-mono text-error">{entry.error}</div>
                    : <div className="text-[9px] font-label-mono text-text-muted">{(entry.file.size / 1024 / 1024).toFixed(2)} MB</div>
                  }
                </div>
                <button onClick={() => setEntries((p) => p.filter((e) => e.id !== entry.id))} className="text-text-muted hover:text-error transition-colors p-0.5">
                  <X size={14} />
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-label-mono text-text-muted">{validCount} file{validCount !== 1 ? "s" : ""} ready to upload</span>
              <button
                id="upload-submit-btn"
                onClick={handleUpload}
                disabled={uploading || validCount === 0}
                className="btn-primary flex items-center gap-2 py-2 px-5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? <><Loader2 size={12} className="animate-spin" /> Uploading…</> : <><Sparkles size={12} /> Process {validCount} file{validCount !== 1 ? "s" : ""}</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job progress */}
      <AnimatePresence>
        {job && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-surface-raised border border-border-default p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-3">
              <h2 className="font-semibold text-xs tracking-tight uppercase">Processing Documents</h2>
              <span className={`text-[10px] font-label-mono font-medium px-2 py-0.5 rounded border ${
                job.status === "done" ? "bg-primary/10 border-primary/20 text-primary" :
                job.status === "error" ? "bg-error/10 border-error/20 text-error" :
                "bg-surface-overlay border-border-subtle text-text-muted"
              }`}>
                {job.status}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mastery-bar mb-4">
              <motion.div
                className="mastery-bar-fill bg-primary"
                animate={{ width: `${job.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Files */}
            <div className="space-y-2 mb-4">
              {job.files.map((f) => (
                <div key={f.fileName} className="flex items-center gap-3 text-xs">
                  {f.status === "done" ? <CheckCircle2 size={14} className="text-primary shrink-0" />
                    : f.status === "error" ? <XCircle size={14} className="text-error shrink-0" />
                    : f.status === "processing" ? <Loader2 size={14} className="text-primary animate-spin shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-full border border-border-default shrink-0" />}
                  <span className="truncate text-text-secondary">{f.fileName}</span>
                  {f.status === "done" && f.conceptsFound.length > 0 && (
                    <span className="text-[10px] font-label-mono text-text-muted ml-auto shrink-0">{f.conceptsFound.length} concepts</span>
                  )}
                </div>
              ))}
            </div>

            {/* Concepts found */}
            {job.status === "done" && job.conceptsFound.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <p className="text-[10px] font-label-caps text-text-muted mb-2.5">Concepts Indexed:</p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {job.conceptsFound.slice(0, 20).map((c) => (
                    <span key={c} className="concept-pill">{c}</span>
                  ))}
                  {job.conceptsFound.length > 20 && (
                    <span className="concept-pill">+{job.conceptsFound.length - 20} more</span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
