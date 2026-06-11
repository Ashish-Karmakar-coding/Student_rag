/**
 * apps/backend/api/index.ts
 *
 * Vercel Serverless Function entry point for the Hono backend.
 *
 * Vercel auto-detects TypeScript files in the api/ directory and compiles them.
 * This file imports from ../src/app.ts (source), which Vercel bundles via esbuild.
 *
 * Runtime: Node.js (not Edge) — required for mongoose, crypto, file parsers.
 * Max duration: 60s (configured in vercel.json for AI generation requests).
 *
 * NODEJS_HELPERS=0 is set in vercel.json — required so Vercel does not wrap
 * requests in a way that breaks Hono's Web Standard Request handling on POST.
 */

import { handle } from "hono/vercel";
// @ts-ignore — Vercel bundles this from source; .js extension is correct for ESM
import app from "../src/app.js";

export const runtime = "nodejs";

export default handle(app);
