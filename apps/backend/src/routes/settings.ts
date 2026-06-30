/**
 * apps/backend/src/routes/settings.ts
 *
 * Settings routes (all require authMiddleware):
 *   GET    /settings           → return providerConfig (no key values)
 *   PATCH  /settings           → update providerConfig in MongoDB
 *   POST   /settings/api-key   → save key to OS keychain
 *   DELETE /settings/api-key   → remove key from OS keychain
 *   GET    /settings/test      → test current provider connectivity
 */

import { Hono } from "hono";
import { PatchSettingsSchema, SaveApiKeySchema } from "@study-tutor/shared";
import { authMiddleware } from "../auth/middleware.js";
import { User } from "../models/User.js";
import { saveApiKey, deleteApiKey, hasApiKey } from "../providers/keychain.js";
import { testProvider } from "../providers/factory.js";

export const settingsRoutes = new Hono();

// Apply auth to all settings routes
settingsRoutes.use("*", authMiddleware);

// ── GET /settings ─────────────────────────────────────────────────────────────

settingsRoutes.get("/", async (c) => {
  const user = c.var.user;
  const { providerConfig } = user;

  // Check if key is actually stored in keychain (may differ from DB flag)
  const keyStored =
    providerConfig.provider !== "ollama"
      ? await hasApiKey(user.githubId, providerConfig.provider)
      : false;

  return c.json({
    provider: providerConfig.provider,
    model: providerConfig.model,
    ollamaUrl: providerConfig.ollamaUrl,
    embedProvider: providerConfig.embedProvider,
    embedModel: providerConfig.embedModel,
    keyStored,
    // NOTE: never return the actual API key
  });
});

// ── PATCH /settings ───────────────────────────────────────────────────────────

settingsRoutes.patch("/", async (c) => {
  const user = c.var.user;

  const bodyResult = PatchSettingsSchema.safeParse(await c.req.json());
  if (!bodyResult.success) {
    return c.json(
      { error: "Invalid settings", details: bodyResult.error.flatten() },
      400
    );
  }

  const { providerConfig } = bodyResult.data;

  await User.updateOne(
    { githubId: user.githubId },
    {
      $set: {
        "providerConfig.provider": providerConfig.provider,
        "providerConfig.model": providerConfig.model,
        "providerConfig.ollamaUrl": providerConfig.ollamaUrl ?? "http://localhost:11434",
        "providerConfig.embedProvider": providerConfig.embedProvider ?? "pinecone",
        "providerConfig.embedModel": providerConfig.embedProvider === "openai" ? "text-embedding-3-small" : (providerConfig.embedProvider === "ollama" ? "nomic-embed-text" : "llama-text-embed-v2"),
      },
    }
  );

  return c.json({ ok: true, message: "Settings saved" });
});

// ── POST /settings/api-key ────────────────────────────────────────────────────

settingsRoutes.post("/api-key", async (c) => {
  const user = c.var.user;

  const bodyResult = SaveApiKeySchema.safeParse(await c.req.json());
  if (!bodyResult.success) {
    return c.json(
      { error: "Invalid request", details: bodyResult.error.flatten() },
      400
    );
  }

  const { provider, apiKey } = bodyResult.data;

  await saveApiKey(user.githubId, provider, apiKey);

  // Update keyStored flag in MongoDB
  await User.updateOne(
    { githubId: user.githubId },
    { $set: { "providerConfig.keyStored": true } }
  );

  return c.json({ ok: true, message: `${provider} API key saved` });
});

// ── DELETE /settings/api-key ──────────────────────────────────────────────────

settingsRoutes.delete("/api-key", async (c) => {
  const user = c.var.user;

  const body = (await c.req.json()) as { provider?: string };
  const provider = body.provider ?? user.providerConfig.provider;

  await deleteApiKey(user.githubId, provider);

  await User.updateOne(
    { githubId: user.githubId },
    { $set: { "providerConfig.keyStored": false } }
  );

  return c.json({ ok: true, message: `${provider} API key removed` });
});

// ── GET /settings/test ────────────────────────────────────────────────────────

settingsRoutes.get("/test", async (c) => {
  const user = c.var.user;
  const { providerConfig } = user;

  // Ollama with a localhost URL is only accessible on the user's machine — not
  // from Vercel's cloud servers. Short-circuit immediately with a clear message.
  // If the user has set a public tunnel URL (ngrok etc.), fall through to the
  // real test so we can verify connectivity.
  const ollamaUrl = providerConfig.ollamaUrl ?? "http://localhost:11434";
  const isLocalOllama =
    providerConfig.provider === "ollama" &&
    (ollamaUrl.includes("localhost") ||
      ollamaUrl.includes("127.0.0.1") ||
      ollamaUrl.includes("::1"));

  if (isLocalOllama) {
    return c.json(
      {
        ok: false,
        latencyMs: 0,
        model: providerConfig.model,
        error:
          "Ollama URL is set to localhost — not reachable from Vercel. " +
          "Run ngrok in a terminal (ngrok http 11434), copy the HTTPS URL, " +
          "paste it in Settings → Ollama Server URL, and save.",
        hint: "local_only",
      },
      200 // 200, not 503 — expected behaviour, not a server error
    );
  }

  const result = await testProvider({
    ...providerConfig,
    userId: user.githubId,
  });

  if (!result.ok) {
    return c.json(result, 503);
  }

  return c.json(result);
});
