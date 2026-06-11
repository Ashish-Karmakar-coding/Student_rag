/**
 * apps/backend/src/routes/auth.ts
 *
 * Auth routes:
 *   POST /auth/sync    — verify NextAuth JWT, upsert user, set backend cookie
 *   POST /auth/logout  — clear cookie
 *   GET  /auth/me      — return public profile (no sensitive fields)
 */

import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { SyncUserSchema } from "@study-tutor/shared";
import { verifyNextAuthToken, signBackendToken, ACCESS_TOKEN_COOKIE, cookieOptions } from "../auth/jwt.js";
import { User } from "../models/User.js";
import { authMiddleware } from "../auth/middleware.js";
import { isDev } from "../config.js";

export const authRoutes = new Hono();

// ── POST /auth/sync ───────────────────────────────────────────────────────────

authRoutes.post("/sync", async (c) => {
  console.log("[/auth/sync] Started");
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    console.log("[/auth/sync] Missing token");
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  let nextAuthPayload;
  try {
    nextAuthPayload = await verifyNextAuthToken(token);
    console.log("[/auth/sync] Token verified:", nextAuthPayload.sub);
  } catch (err) {
    console.error("[/auth/sync] verifyNextAuthToken failed:", err);
    return c.json({ error: "Invalid NextAuth token" }, 401);
  }

  const bodyRaw = await c.req.json();
  const bodyResult = SyncUserSchema.safeParse(bodyRaw);
  if (!bodyResult.success) {
    console.log("[/auth/sync] Invalid body", bodyResult.error.flatten());
    return c.json({ error: "Invalid request body", details: bodyResult.error.flatten() }, 400);
  }

  const { githubId, login, avatarUrl, email } = bodyResult.data;
  console.log("[/auth/sync] Parsed body for githubId:", githubId);

  const tokenGithubId = nextAuthPayload.githubId ?? nextAuthPayload.sub;
  if (tokenGithubId && tokenGithubId !== githubId) {
    console.log("[/auth/sync] Mismatch githubId");
    return c.json({ error: "Token/body githubId mismatch" }, 401);
  }

  console.log("[/auth/sync] Calling MongoDB findOneAndUpdate");
  try {
    const user = await User.findOneAndUpdate(
      { githubId },
      {
        $set: { login, avatarUrl, email, lastSeen: new Date() },
        $setOnInsert: {
          createdAt: new Date(),
          hasFiles: false,
          providerConfig: {
            provider: "ollama",
            model: "llama3",
            ollamaUrl: "http://localhost:11434",
            keyStored: false,
            embedProvider: "ollama",
            embedModel: "nomic-embed-text",
          },
        },
      },
      { upsert: true, new: true, maxTimeMS: 5000 }
    );
    console.log("[/auth/sync] MongoDB operation completed", user ? "User found/created" : "Null user");

    console.log("[/auth/sync] Signing backend token");
    const backendToken = await signBackendToken(githubId, login);

    console.log("[/auth/sync] Setting cookie");
    setCookie(c, ACCESS_TOKEN_COOKIE, backendToken, cookieOptions(isDev));

    console.log("[/auth/sync] Returning success");
    return c.json({
      ok: true,
      user: {
        githubId: user!.githubId,
        login: user!.login,
        avatarUrl: user!.avatarUrl,
        hasFiles: user!.hasFiles,
        provider: user!.providerConfig.provider,
      },
    });
  } catch (err) {
    console.error("[/auth/sync] Error during DB operation or token signing:", err);
    return c.json({ error: "Internal server error during sync" }, 500);
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────

authRoutes.post("/logout", (c) => {
  deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────

authRoutes.get("/me", authMiddleware, (c) => {
  const user = c.var.user;
  return c.json({
    githubId: user.githubId,
    login: user.login,
    avatarUrl: user.avatarUrl,
    email: user.email,
    hasFiles: user.hasFiles,
    provider: user.providerConfig.provider,
    providerConfig: {
      provider: user.providerConfig.provider,
      model: user.providerConfig.model,
      ollamaUrl: user.providerConfig.ollamaUrl,
      keyStored: user.providerConfig.keyStored,
      embedProvider: user.providerConfig.embedProvider,
      embedModel: user.providerConfig.embedModel,
    },
  });
});
