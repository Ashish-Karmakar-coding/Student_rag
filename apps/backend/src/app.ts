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
import { isDev } from "./config.js";
import { connectDB, resetConnection } from "./database.js";

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

// Intercept favicon requests early — no DB or CORS work needed
app.get("/favicon.ico", (c) => c.body(null, 204));
app.get("/favicon.png", (c) => c.body(null, 204));

// ── CORS (must run before DB connect) ─────────────────────────────────────────
// OPTIONS preflight and error responses must not wait on MongoDB.
// Vercel requires NODEJS_HELPERS=0 (see vercel.json) for Hono POST bodies.
// In production set ALLOWED_ORIGINS as a comma-separated list, e.g.:
//   ALLOWED_ORIGINS=https://app.yourdomain.com,https://yourdomain.com
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

// ── DB connect middleware (serverless-safe) ───────────────────────────────────
// Ensures MongoDB is connected before data routes. Runs after CORS so preflight
// and lightweight routes are not blocked by Atlas cold starts.
const DB_CONNECT_TIMEOUT_MS = 12_000;

app.use("*", async (c, next) => {
  // Root health probe does not need MongoDB
  if (c.req.path === "/") {
    return next();
  }

  try {
    await Promise.race([
      connectDB(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Database connection timed out")),
          DB_CONNECT_TIMEOUT_MS
        )
      ),
    ]);
  } catch (err) {
    resetConnection();
    console.error("[connectDB middleware]", err);
    return c.json(
      {
        error: "Database unavailable",
        message: isDev && err instanceof Error ? err.message : "Please try again shortly",
      },
      503
    );
  }

  await next();
});

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
