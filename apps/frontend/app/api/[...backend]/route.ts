/**
 * apps/frontend/app/api/[...backend]/route.ts
 *
 * Catch-all API route that mounts the Hono backend as Next.js API routes.
 * This allows the entire backend to run serverless on Vercel.
 *
 * All requests to /api/* are handled by the Hono app.
 */

// Force dynamic rendering - don't try to pre-render during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { Hono } from "hono";
import { handle } from "hono/vercel";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

// Import backend modules
// Note: These imports assume backend source is accessible from frontend
// We'll need to either:
// 1. Move backend src into frontend, OR
// 2. Use TypeScript path aliases to reference ../../../backend/src

// For now, we'll import the core Hono app setup inline
// TODO: Refactor to import from backend

import { connectDB } from "@/lib/backend-src/database";

// Import route modules
import { authRoutes } from "@/lib/backend-src/routes/auth";
import { settingsRoutes } from "@/lib/backend-src/routes/settings";
import { ingestRoutes } from "@/lib/backend-src/routes/ingest";
import { chatRoutes } from "@/lib/backend-src/routes/chat";
import { quizRoutes } from "@/lib/backend-src/routes/quiz";
import { masteryRoutes } from "@/lib/backend-src/routes/mastery";
import { sessionRoutes } from "@/lib/backend-src/routes/sessions";
import { healthRoutes } from "@/lib/backend-src/routes/health";

// ── App ───────────────────────────────────────────────────────────────────────

const app = new Hono().basePath("/api");

// ── Global middleware ─────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV === "development";

// CORS — Vercel handles same-origin, but configure for flexibility
app.use(
  "*",
  cors({
    origin: isDev
      ? ["http://localhost:3000", "http://127.0.0.1:3000"]
      : "*", // Allow all origins in production (same-origin for Vercel)
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Request logger (dev only)
if (isDev) {
  app.use("*", logger());
}

// ── Database connection (serverless-safe) ─────────────────────────────────────

app.use("*", async (c, next) => {
  try {
    await connectDB();
    await next();
  } catch (err) {
    console.error("Database connection failed:", err);
    return c.json(
      {
        error: "Database unavailable",
        message: isDev ? (err as Error).message : "Service temporarily unavailable",
      },
      503
    );
  }
});

// ── Root health check ─────────────────────────────────────────────────────────

app.get("/", (c) =>
  c.json({
    service: "Adaptive Study Tutor API",
    version: "0.1.0",
    status: "running",
    environment: "vercel",
    timestamp: new Date().toISOString(),
  })
);

// ── Route groups ──────────────────────────────────────────────────────────────

app.route("/auth", authRoutes);
app.route("/settings", settingsRoutes);
app.route("/", ingestRoutes);
app.route("/", chatRoutes);
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

// ── Export Next.js route handlers ─────────────────────────────────────────────

// Vercel's handle() adapter converts Hono app to Next.js route handlers
export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
