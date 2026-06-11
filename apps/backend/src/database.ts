/**
 * apps/backend/src/database.ts
 *
 * Mongoose connection optimized for serverless environments (Vercel).
 * Caches connection across lambda invocations to avoid cold start penalties.
 * Call connectDB() at the start of each API route handler.
 */

import mongoose from "mongoose";
import { env } from "./config.js";

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
  mongoose.set("bufferCommands", false);
  cachedConnection = mongoose.connect(env.MONGODB_URI, {
    // Serverless-optimized settings
    maxPoolSize: 10,
    minPoolSize: 0, // Lower pool size to 0 to avoid background retry loops
    serverSelectionTimeoutMS: 5000, // Fail fast if Atlas is unreachable
    socketTimeoutMS: 30000,
    connectTimeoutMS: 5000,
    bufferCommands: false, // Do not buffer commands if connection is not ready
    // Keep connections alive across invocations
    maxIdleTimeMS: 60000,
  } as any); // Cast options if Mongoose types don't match exactly

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
