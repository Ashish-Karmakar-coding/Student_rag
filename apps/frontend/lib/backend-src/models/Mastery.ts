/**
 * apps/backend/src/models/Mastery.ts
 *
 * Tracks per-user, per-concept mastery scores.
 * One document per (userId, concept) pair.
 *
 * Score range: 0.05 (never tested / struggling) → 0.99 (mastered).
 * Default seeded at 0.5 (neutral) on first document ingest.
 *
 * Update formula (applied after each quiz answer):
 *   newScore = clamp(old + 0.15 * (correctness - old), 0.05, 0.99)
 */

import mongoose, { Schema, type Document, type Model } from "mongoose";

// ── TypeScript interface ───────────────────────────────────────────────────────

export interface IMastery extends Document {
  userId: string;       // githubId
  concept: string;      // lowercase, e.g. "meiosis"
  subject: string;      // top-level subject inferred from file/chunk
  score: number;        // 0.0 – 1.0
  attemptCount: number;
  correctCount: number;
  lastTested: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const MasterySchema = new Schema<IMastery>(
  {
    userId: { type: String, required: true, index: true },
    concept: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    subject: {
      type: String,
      default: "general",
      lowercase: true,
      trim: true,
    },
    score: {
      type: Number,
      required: true,
      default: 0.5,
      min: 0.0,
      max: 1.0,
    },
    attemptCount: { type: Number, default: 0, min: 0 },
    correctCount: { type: Number, default: 0, min: 0 },
    lastTested: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Primary lookup: one mastery entry per user+concept
MasterySchema.index({ userId: 1, concept: 1 }, { unique: true });

// Weak-first query: sorted by score ascending for a given user
MasterySchema.index({ userId: 1, score: 1 });

// Dashboard subject breakdown
MasterySchema.index({ userId: 1, subject: 1 });

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Applies the mastery update formula.
 * correctness: 0.0–1.0 from LLM evaluation.
 * Returns the clamped new score.
 */
export function calcNewMasteryScore(
  currentScore: number,
  correctness: number
): number {
  const raw = currentScore + 0.15 * (correctness - currentScore);
  return Math.max(0.05, Math.min(0.99, raw));
}

// ── Model ─────────────────────────────────────────────────────────────────────

export const Mastery: Model<IMastery> =
  mongoose.models["Mastery"] ??
  mongoose.model<IMastery>("Mastery", MasterySchema);
