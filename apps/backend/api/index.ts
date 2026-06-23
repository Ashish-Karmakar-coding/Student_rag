/**
 * apps/backend/api/index.ts
 *
 * Vercel Serverless Function entry point for the Hono backend.
 *
 * Uses @hono/node-server's getRequestListener to properly convert
 * Node.js IncomingMessage → Web Standard Request. This avoids the
 * "this.raw.headers.get is not a function" error on newer Vercel
 * Rust-based runtimes where the hono/vercel adapter receives a
 * request with plain-object headers instead of a Web `Headers` instance.
 *
 * Vercel auto-detects TypeScript files in the api/ directory and compiles them.
 * This file imports from ../src/app.ts (source), which Vercel bundles via esbuild.
 *
 * Runtime: Node.js — required for mongoose, crypto, file parsers.
 * Max duration: 60s (configured in vercel.json for AI generation requests).
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { getRequestListener } from "@hono/node-server";
// @ts-ignore — Vercel bundles this from source; .js extension is correct for ESM
import app from "../src/app.js";

/**
 * getRequestListener converts Node.js IncomingMessage to a proper
 * Web Standard Request (with real Headers, URL, body stream),
 * then calls app.fetch and writes the Response to ServerResponse.
 *
 * This is more robust than hono/vercel's handle() because it does
 * the HTTP ↔ Web Standard conversion explicitly, independent of
 * Vercel's runtime internals.
 */
const listener = getRequestListener(app.fetch);

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return listener(req, res);
}
