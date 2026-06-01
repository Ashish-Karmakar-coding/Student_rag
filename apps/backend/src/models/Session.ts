/**
 * apps/backend/src/models/Session.ts
 *
 * A study session — one per "chat conversation."
 * Messages are embedded as an array (document model, not relational).
 * Each message carries its own concept tags and source citations.
 *
 * Sessions are written to MongoDB at the end of each /chat request
 * (after the SSE stream completes) and are read back for the sidebar.
 */

import mongoose, { Schema, type Document, type Model } from "mongoose";

// ── Sub-interfaces ────────────────────────────────────────────────────────────

export interface ISource {
  fileName: string;
  chunkIndex: number;
  page?: number;
}

export interface IMessage {
  role: "user" | "assistant";
  text: string;
  conceptTags: string[];
  sources: ISource[];
  timestamp: Date;
}

// ── Main interface ────────────────────────────────────────────────────────────

export interface ISession extends Document {
  userId: string;
  subject: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const SourceSchema = new Schema<ISource>(
  {
    fileName: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    page: { type: Number },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    text: { type: String, required: true },
    conceptTags: { type: [String], default: [] },
    sources: { type: [SourceSchema], default: [] },
    timestamp: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: String, required: true, index: true },
    subject: { type: String, default: "general" },
    messages: { type: [MessageSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Sidebar query: sessions for a user, most recent first
SessionSchema.index({ userId: 1, updatedAt: -1 });

// ── Model ─────────────────────────────────────────────────────────────────────

export const Session: Model<ISession> =
  mongoose.models["Session"] ??
  mongoose.model<ISession>("Session", SessionSchema);
