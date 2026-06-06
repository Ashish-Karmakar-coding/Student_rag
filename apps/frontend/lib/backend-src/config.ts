/**
 * apps/backend/src/config.ts
 *
 * Parses and validates all environment variables with Zod.
 * Validation is skipped during Next.js build phase.
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

  // ── Optional integrations ──────────────────────────────────────────────────
  COHERE_API_KEY: z.string().optional(),

  // ── keytar fallback (used when native bindings unavailable) ───────────────
  KEYTAR_FALLBACK_OPENAI_KEY: z.string().optional(),
  KEYTAR_FALLBACK_ANTHROPIC_KEY: z.string().optional(),
});

// Check if we're in Next.js build phase
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' ||
                    process.env.NEXT_PHASE === 'phase-development-build' ||
                    process.env.npm_lifecycle_event === 'build';

let _env: z.infer<typeof EnvSchema> | null = null;

function validateEnv() {
  if (_env) return _env;

  // Skip validation during build time
  if (isBuildTime) {
    console.log("⚠️  Skipping env validation during build phase");
    _env = {} as z.infer<typeof EnvSchema>;
    return _env;
  }

  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌  Invalid environment variables:\n");
    parsed.error.issues.forEach((issue) => {
      console.error(`  • ${issue.path.join(".")}: ${issue.message}`);
    });
    console.error("\nPlease set the required environment variables in Vercel dashboard.");
    throw new Error("Invalid environment configuration");
  }

  _env = parsed.data;
  return _env;
}

// Export a getter to make validation lazy
export const env = new Proxy({} as z.infer<typeof EnvSchema>, {
  get(_, prop) {
    const validated = validateEnv();
    return validated[prop as keyof typeof validated];
  }
});

export const isDev = process.env.NODE_ENV === "development";
export const isProd = process.env.NODE_ENV === "production";
