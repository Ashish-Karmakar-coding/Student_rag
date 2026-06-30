/**
 * apps/backend/src/models/PendingQuestion.ts
 *
 * MongoDB-backed store for pending Socratic quiz questions.
 *
 * WHY THIS EXISTS:
 * The quiz route previously used an in-memory Map (pendingQuestions) with
 * setInterval for TTL cleanup. This fundamentally breaks on Vercel serverless
 * because each function invocation gets a fresh process — the Map is empty
 * on every cold start, so a question created in one invocation is NEVER
 * visible to the next invocation handling /quiz/answer.
 *
 * This model uses MongoDB with a TTL index to auto-expire documents after
 * 10 minutes, providing a serverless-safe persistent store.
 *
 * TTL: MongoDB's TTL index deletes documents automatically after expiry.
 * No application-level cleanup is needed.
 */

import mongoose, { Schema, type Document, type Model } from "mongoose";

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IPendingQuestion extends Document {
  questionId: string;   // uuid v4 — returned to frontend
  userId: string;       // GitHub ID — for authZ check on /quiz/answer
  concept: string;
  question: string;
  hint: string;
  masteryBefore: number;
  /** Serialised RetrievedChunk[] — stored as JSON string to avoid subdoc complexity */
  chunksJson: string;
  /** TTL field — MongoDB deletes the document after this date */
  expiresAt: Date;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const PendingQuestionSchema = new Schema<IPendingQuestion>(
  {
    questionId: { type: String, required: true, unique: true, index: true },
    userId:     { type: String, required: true },
    concept:    { type: String, required: true },
    question:   { type: String, required: true },
    hint:       { type: String, required: true },
    masteryBefore: { type: Number, required: true },
    chunksJson: { type: String, required: true },
    expiresAt:  { type: Date, required: true },
  },
  { versionKey: false }
);

// TTL index — MongoDB deletes the document when `expiresAt` is reached.
// The index fires approximately every 60 seconds (MongoDB TTL monitor interval).
PendingQuestionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ── Model ─────────────────────────────────────────────────────────────────────

export const PendingQuestion: Model<IPendingQuestion> =
  mongoose.models["PendingQuestion"] ??
  mongoose.model<IPendingQuestion>("PendingQuestion", PendingQuestionSchema);
