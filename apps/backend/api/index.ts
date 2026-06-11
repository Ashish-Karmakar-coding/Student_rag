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
 */

import { handle } from "@hono/node-server/vercel";
// @ts-ignore — Vercel bundles this from source; .js extension is correct for ESM
import app from "../src/app.js";

export const runtime = "nodejs";

export default handle(app);
