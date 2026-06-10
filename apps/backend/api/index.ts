/**
 * apps/backend/api/index.ts
 *
 * Vercel Serverless Function entry point for the Hono backend.
 *
 * This file is auto-detected by Vercel when the project root is apps/backend.
 * The vercel.json rewrites all requests (/*) to this handler.
 *
 * Uses the Node.js runtime (not Edge) because the app depends on:
 *   - mongoose (MongoDB driver)
 *   - crypto (Node built-in, AES-256-GCM key encryption)
 *   - pdf-parse, mammoth (file parsing)
 */

import { handle } from "hono/vercel";
import app from "../src/app.js";

// Force Node.js runtime — required for mongoose, crypto, file parsers
export const runtime = "nodejs";

// Vercel invokes the default export as the HTTP handler
export default handle(app);
