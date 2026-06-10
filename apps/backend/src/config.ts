/**
 * apps/backend/src/config.ts
 *
 * Parses and validates all environment variables with Zod.
 * Fails fast at startup if any required variable is missing or malformed.
 * Import `env` from this module — never read process.env directly elsewhere.
 */

import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  // ── Server ─────────────────────────────────────────────────────────────────
  PORT: z.coerce.number().int().positive().default(8000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // ── MongoDB ────────────────────────────────────────────────────────────────
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .startsWith("mongodb", "MONGODB_URI must start with mongodb"),

  // ── Pinecone ───────────────────────────────────────────────────────────────
  PINECONE_API_KEY: z.string().min(1, "PINECONE_API_KEY is required"),
  PINECONE_INDEX_NAME: z.string().default("study-tutor"),

  // ── JWT secrets ────────────────────────────────────────────────────────────
  APP_SECRET: z
    .string()
    .min(32, "APP_SECRET must be at least 32 characters"),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters"),

});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌  Invalid environment variables:\n");
  parsed.error.issues.forEach((issue) => {
    console.error(`  • ${issue.path.join(".")}: ${issue.message}`);
  });
  console.error("\nPlease copy apps/backend/.env.example to apps/backend/.env and fill in the values.");
  process.exit(1);
}

export const env = parsed.data;

export const isDev = env.NODE_ENV === "development";
export const isProd = env.NODE_ENV === "production";
