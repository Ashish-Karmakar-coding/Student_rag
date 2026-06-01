/**
 * apps/backend/src/index.ts
 *
 * Hono application bootstrap.
 * - Registers all middleware (CORS, logger)
 * - Mounts all route groups
 * - Starts the Node.js HTTP server via @hono/node-server
 * - Connects to MongoDB on startup
 * - Handles graceful shutdown (SIGTERM / SIGINT)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { env, isDev } from "./config.js";
import { connectDB, disconnectDB } from "./database.js";

// ── Route imports ─────────────────────────────────────────────────────────────
import { authRoutes }     from "./routes/auth.js";
import { settingsRoutes } from "./routes/settings.js";
import { ingestRoutes }   from "./routes/ingest.js";
import { chatRoutes }     from "./routes/chat.js";
import { quizRoutes }     from "./routes/quiz.js";
import { masteryRoutes }  from "./routes/mastery.js";
import { sessionRoutes }  from "./routes/sessions.js";
import { healthRoutes }   from "./routes/health.js";

// ── App ───────────────────────────────────────────────────────────────────────

const app = new Hono();

// ── Global middleware ─────────────────────────────────────────────────────────

// CORS — allow frontend origin only
app.use(
  "*",
  cors({
    origin: isDev
      ? ["http://localhost:3000", "http://127.0.0.1:3000"]
      : (process.env["ALLOWED_ORIGIN"] ?? "https://yourdomain.com"),
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true, // allow cookies
  })
);

// Request logger (dev only to avoid log noise in production)
if (isDev) {
  app.use("*", logger());
}

// ── Root health check (unauthenticated) ───────────────────────────────────────
app.get("/", (c) =>
  c.json({
    service: "Adaptive Study Tutor API",
    version: "0.1.0",
    status: "running",
    timestamp: new Date().toISOString(),
  })
);

// ── Route groups ──────────────────────────────────────────────────────────────

app.route("/auth",      authRoutes);
app.route("/settings",  settingsRoutes);
app.route("/",          ingestRoutes);   // /upload, /ingest-status/:jobId
app.route("/",          chatRoutes);     // /chat
app.route("/quiz",      quizRoutes);
app.route("/mastery",   masteryRoutes);
app.route("/sessions",  sessionRoutes);
app.route("/health",    healthRoutes);

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

// ── Server bootstrap ──────────────────────────────────────────────────────────

async function bootstrap() {
  console.log("🚀  Starting Adaptive Study Tutor backend...");

  // Connect to MongoDB first
  await connectDB();

  const server = serve(
    {
      fetch: app.fetch,
      port: env.PORT,
    },
    (info) => {
      console.log(`✅  Server listening on http://localhost:${info.port}`);
      console.log(`📋  Environment: ${env.NODE_ENV}`);
    }
  );

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      console.log("👋  Goodbye.");
      process.exit(0);
    });

    // Force exit after 10s if still not closed
    setTimeout(() => {
      console.error("❌  Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error("❌  Bootstrap failed:", err);
  process.exit(1);
});

export default app;
