/**
 * apps/backend/src/database.ts
 *
 * Mongoose connection with retry logic and graceful shutdown.
 * Call connectDB() once at startup. All models are registered at import time.
 */

import mongoose from "mongoose";
import { env } from "./config.js";

const RETRY_DELAY_MS = 5_000;
const MAX_RETRIES = 5;

let retries = 0;

export async function connectDB(): Promise<void> {
  mongoose.set("strictQuery", true);

  // Log mongoose query errors in development
  if (env.NODE_ENV === "development") {
    mongoose.set("debug", false); // flip to true for query logging
  }

  mongoose.connection.on("connected", () => {
    console.log("✅  MongoDB connected");
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️   MongoDB disconnected");
  });

  mongoose.connection.on("error", (err: Error) => {
    console.error("❌  MongoDB error:", err.message);
  });

  await attempt();
}

async function attempt(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      // Connection pool — sensible defaults for a single backend instance
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      connectTimeoutMS: 10_000,
    });
    retries = 0;
  } catch (err) {
    retries++;
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `❌  MongoDB connection failed (attempt ${retries}/${MAX_RETRIES}): ${errMsg}`
    );

    if (retries >= MAX_RETRIES) {
      console.error("❌  Max MongoDB retries reached. Exiting.");
      process.exit(1);
    }

    console.log(`⏳  Retrying in ${RETRY_DELAY_MS / 1000}s...`);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    await attempt();
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.log("🔌  MongoDB disconnected (graceful shutdown)");
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
