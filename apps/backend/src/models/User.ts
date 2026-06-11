/**
 * apps/backend/src/models/User.ts
 *
 * Mongoose schema for authenticated users.
 * One document per GitHub user. Stores provider config and metadata.
 * API keys are stored encrypted (AES-256-GCM) in encryptedKeys field.
 */

import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { ProviderConfig } from "@study-tutor/shared";

// ── TypeScript interface ───────────────────────────────────────────────────────

export interface IUser extends Document {
  githubId: string;
  login: string;
  avatarUrl: string;
  email: string | null;
  createdAt: Date;
  lastSeen: Date;
  /** True once the user has successfully ingested at least one file */
  hasFiles: boolean;
  providerConfig: {
    provider: ProviderConfig["provider"];
    model: string;
    ollamaUrl: string;
    /** True when an API key has been saved to the OS keychain */
    keyStored: boolean;
    embedProvider: string;
    embedModel: string;
  };
  /** Encrypted API keys (encrypted with APP_SECRET) - serverless-compatible */
  encryptedKeys?: {
    openai?: string;
    anthropic?: string;
  };
}

// ── Subdocument schema ────────────────────────────────────────────────────────

const ProviderConfigSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ["ollama", "openai", "anthropic"],
      default: "ollama",
    },
    model: { type: String, default: "llama3" },
    ollamaUrl: { type: String, default: "http://localhost:11434" },
    keyStored: { type: Boolean, default: false },
    embedProvider: { type: String, default: "ollama" },
    embedModel: { type: String, default: "nomic-embed-text" },
  },
  { _id: false } // embedded subdoc, no separate _id
);

// ── Main schema ───────────────────────────────────────────────────────────────

const UserSchema = new Schema<IUser>(
  {
    githubId: {
      type: String,
      required: true,
      unique: true,
    },
    login: { type: String, required: true },
    avatarUrl: { type: String, required: true },
    email: { type: String, default: null },
    hasFiles: { type: Boolean, default: false },
    providerConfig: {
      type: ProviderConfigSchema,
      default: () => ({}), // uses subdoc defaults
    },
    encryptedKeys: {
      type: {
        openai: { type: String },
        anthropic: { type: String },
      },
      default: undefined,
      select: false, // Don't return by default for security
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "lastSeen" },
    versionKey: false,
  }
);

// ── Model ─────────────────────────────────────────────────────────────────────

export const User: Model<IUser> =
  mongoose.models["User"] ??
  mongoose.model<IUser>("User", UserSchema);
