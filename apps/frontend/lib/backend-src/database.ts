/**
 * apps/backend/src/database.ts
 *
 * Mongoose connection optimized for serverless environments (Vercel).
 * Caches connection across lambda invocations to avoid cold start penalties.
 * Call connectDB() at the start of each API route handler.
 */

import mongoose from "mongoose";
import { env } from "./config";

// ── Connection caching for serverless ─────────────────────────────────────────

/**
 * In serverless, the global scope persists across invocations within the same
 * container. We cache the connection promise to prevent concurrent connection
 * attempts and reuse existing connections.
 */
let cachedConnection: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<void> {
  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // If connection attempt is in progress, wait for it
  if (cachedConnection) {
    await cachedConnection;
    return;
  }

  // Start new connection attempt
  cachedConnection = mongoose.connect(env.MONGODB_URI, {
    // Serverless-optimized pool settings
    maxPoolSize: 10,
    minPoolSize: 1, // Lower minimum for faster cold starts
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    connectTimeoutMS: 10_000,
    // Keep connections alive across invocations
    maxIdleTimeMS: 60_000,
  });

  try {
    await cachedConnection;
    console.log("✅  MongoDB connected");
  } catch (err) {
    cachedConnection = null; // Clear cache on failure
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌  MongoDB connection failed: ${errMsg}`);
    throw new Error(`Database connection failed: ${errMsg}`);
  }
}

/**
 * Graceful disconnect (only used in non-serverless dev environments).
 * In serverless, connections are managed by the platform.
 */
export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    cachedConnection = null;
    console.log("🔌  MongoDB disconnected");
  }
}

/** Convenience: check if MongoDB is reachable (used by /health route) */
export async function pingDB(): Promise<boolean> {
  try {
    const state = mongoose.connection.readyState;
    // 1 = connected
    if (state !== 1) return false;
    await mongoose.connection.db?.admin().ping();
    return true;
  } catch {
    return false;
  }
}
