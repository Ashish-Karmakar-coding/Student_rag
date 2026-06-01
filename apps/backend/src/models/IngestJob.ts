/**
 * apps/backend/src/models/IngestJob.ts
 *
 * Tracks the state of a document ingestion job.
 * Created immediately on POST /upload with status "queued".
 * Updated in-place as each file is processed asynchronously.
 * Frontend polls GET /ingest-status/:jobId every 2s.
 *
 * Progress:  0  → queued
 *            1–99 → processing (per-file %)
 *            100 → all files done
 */

import mongoose, { Schema, type Document, type Model } from "mongoose";

// ── Sub-interfaces ────────────────────────────────────────────────────────────

export type FileStatus = "queued" | "processing" | "done" | "error";
export type JobStatus = "queued" | "processing" | "done" | "error";

export interface IIngestFile {
  fileName: string;
  sizeBytes: number;
  status: FileStatus;
  conceptsFound: string[];
  error?: string;
}

// ── Main interface ────────────────────────────────────────────────────────────

export interface IIngestJob extends Document {
  jobId: string;          // uuid v4 — returned to frontend immediately
  userId: string;         // githubId — for authZ check on GET
  files: IIngestFile[];
  status: JobStatus;
  progress: number;       // 0–100 overall
  createdAt: Date;
  completedAt: Date | null;
}

// ── Sub-schema ────────────────────────────────────────────────────────────────

const IngestFileSchema = new Schema<IIngestFile>(
  {
    fileName: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    status: {
      type: String,
      enum: ["queued", "processing", "done", "error"],
      default: "queued",
    },
    conceptsFound: { type: [String], default: [] },
    error: { type: String },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────

const IngestJobSchema = new Schema<IIngestJob>(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    files: { type: [IngestFileSchema], default: [] },
    status: {
      type: String,
      enum: ["queued", "processing", "done", "error"],
      default: "queued",
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
    versionKey: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

IngestJobSchema.index({ jobId: 1 }, { unique: true });
// For listing a user's recent jobs (if needed later)
IngestJobSchema.index({ userId: 1, createdAt: -1 });

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Recalculates overall progress from individual file statuses.
 * Returns a value from 0–100.
 */
export function calcJobProgress(files: IIngestFile[]): number {
  if (files.length === 0) return 0;
  const doneCount = files.filter(
    (f) => f.status === "done" || f.status === "error"
  ).length;
  return Math.round((doneCount / files.length) * 100);
}

/**
 * Derives the overall job status from individual file statuses.
 */
export function deriveJobStatus(files: IIngestFile[]): JobStatus {
  if (files.every((f) => f.status === "done")) return "done";
  if (files.some((f) => f.status === "error") && files.every((f) => f.status !== "queued" && f.status !== "processing")) return "error";
  if (files.some((f) => f.status === "processing")) return "processing";
  return "queued";
}

// ── Model ─────────────────────────────────────────────────────────────────────

export const IngestJob: Model<IIngestJob> =
  mongoose.models["IngestJob"] ??
  mongoose.model<IIngestJob>("IngestJob", IngestJobSchema);
