/**
 * apps/backend/src/routes/health.ts
 *
 * Health check route (unauthenticated):
 *   GET /health → { mongo, pinecone, llm, timestamp, errors? }
 *
 * Used by Docker health checks and monitoring dashboards.
 * Never returns 5xx — always 200 with status fields.
 */

import { Hono } from "hono";
import { pingDB } from "../database";
import { pingPinecone } from "../ingestion/embedder";
import { isCohereEnabled } from "../retrieval/reranker";
import type { HealthStatus } from "@study-tutor/shared";

export const healthRoutes = new Hono();

healthRoutes.get("/", async (c) => {
  const errors: Record<string, string> = {};

  // ── MongoDB ping ───────────────────────────────────────────────────────────
  let mongoStatus: HealthStatus["mongo"] = "error";
  try {
    const mongoOk = await pingDB();
    mongoStatus = mongoOk ? "ok" : "error";
    if (!mongoOk) errors["mongo"] = "Ping failed";
  } catch (err) {
    errors["mongo"] = err instanceof Error ? err.message : "Unknown error";
  }

  // ── Pinecone ping ──────────────────────────────────────────────────────────
  let pineconeStatus: HealthStatus["pinecone"] = "error";
  try {
    const pineconeOk = await pingPinecone();
    pineconeStatus = pineconeOk ? "ok" : "error";
    if (!pineconeOk) errors["pinecone"] = "describeIndexStats failed";
  } catch (err) {
    errors["pinecone"] = err instanceof Error ? err.message : "Unknown error";
  }

  const response: HealthStatus = {
    mongo: mongoStatus,
    pinecone: pineconeStatus,
    llm: "unconfigured", // no default LLM to ping without user context
    timestamp: new Date().toISOString(),
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  };

  // Extra info fields (not part of HealthStatus type — safe to add)
  return c.json({
    ...response,
    cohere: isCohereEnabled() ? "configured" : "disabled",
    uptime: Math.floor(process.uptime()),
  });
});
