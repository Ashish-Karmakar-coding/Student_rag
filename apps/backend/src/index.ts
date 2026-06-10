/**
 * apps/backend/src/index.ts
 *
 * Local development server bootstrap only.
 * In production (Vercel), use api/index.ts instead — this file is NOT used.
 *
 * Starts the Node.js HTTP server via @hono/node-server and connects to MongoDB.
 */

import { serve } from "@hono/node-server";
import { env } from "./config.js";
import { connectDB, disconnectDB } from "./database.js";
import app from "./app.js";

// ── Server bootstrap ──────────────────────────────────────────────────────────

async function bootstrap() {
  console.log("🚀  Starting Adaptive Study Tutor backend (dev)...");

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

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      console.log("👋  Goodbye.");
      process.exit(0);
    });

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