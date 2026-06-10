/**
 * apps/backend/src/app.ts
 *
 * Hono application setup — middleware + routes.
 * Exported as default so it can be consumed by:
 *   - src/index.ts  (local Node.js dev server via @hono/node-server)
 *   - api/index.ts  (Vercel Serverless via hono/vercel)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env, isDev } from "./config.js";
import { connectDB } from "./database.js";

// ── Route imports ─────────────────────────────────────────────────────────────
import { authRoutes } from "./routes/auth.js";
import { settingsRoutes } from "./routes/settings.js";
import { ingestRoutes } from "./routes/ingest.js";
import { chatRoutes } from "./routes/chat.js";
import { quizRoutes } from "./routes/quiz.js";
import { masteryRoutes } from "./routes/mastery.js";
import { sessionRoutes } from "./routes/sessions.js";
import { healthRoutes } from "./routes/health.js";

// ── App ───────────────────────────────────────────────────────────────────────

const app = new Hono();

// ── DB connect middleware (serverless-safe) ───────────────────────────────────
// Ensures MongoDB is connected before every request.
// connectDB() is idempotent — safe to call on every invocation.
app.use("*", async (c, next) => {
  await connectDB();
  await next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production set ALLOWED_ORIGINS as a comma-separated list, e.g.:
//   ALLOWED_ORIGINS=https://student-rag.vercel.app,https://kairo.ashishkarmakar.in
// Falls back to legacy ALLOWED_ORIGIN for backwards compatibility.
function getAllowedOrigins(): string | string[] {
  if (isDev) {
    return ["http://localhost:3000", "http://127.0.0.1:3000"];
  }
  const multi = process.env["ALLOWED_ORIGINS"];
  if (multi) {
    return multi.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return process.env["ALLOWED_ORIGIN"] ?? "https://yourdomain.com";
}

app.use(
  "*",
  cors({
    origin: getAllowedOrigins(),
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Request logger (dev only)
if (isDev) {
  app.use("*", logger());
}

// ── Root health check ─────────────────────────────────────────────────────────
app.get("/", (c) =>
  c.json({
    service: "Adaptive Study Tutor API",
    version: "0.1.0",
    status: "running",
    timestamp: new Date().toISOString(),
  })
);

// ── Route groups ──────────────────────────────────────────────────────────────

app.route("/auth", authRoutes);
app.route("/settings", settingsRoutes);
app.route("/", ingestRoutes);   // /upload, /ingest-status/:jobId, /files
app.route("/", chatRoutes);     // /chat
app.route("/quiz", quizRoutes);
app.route("/mastery", masteryRoutes);
app.route("/sessions", sessionRoutes);
app.route("/health", healthRoutes);

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.notFound((c) =>
  c.json({ error: `Route not found: ${c.req.method} ${c.req.path}` }, 404)
);

// ── Global error handler ──────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      error: "Internal server error",
      message: isDev ? err.message : "Something went wrong",
    },
    500
  );
});

export default app;
