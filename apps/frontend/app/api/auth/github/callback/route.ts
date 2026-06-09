/**
 * apps/frontend/app/api/auth/github/callback/route.ts
 *
 * NOTE: This file is intentionally a no-op stub.
 *
 * The actual routing is handled by next.config.mjs via a rewrite rule:
 *   /api/auth/github/callback  →  /api/auth/callback/github
 *
 * This rewrite runs BEFORE any route handler, so all cookies (including
 * authjs.state used by NextAuth for OAuth state validation) are preserved
 * identically. The catch-all handler at /api/auth/[...nextauth]/route.ts
 * then processes the callback normally.
 *
 * DO NOT add GET/POST handlers here — they would shadow the rewrite and
 * break the OAuth flow again.
 */

// This file intentionally exports nothing.
// The rewrite in next.config.mjs handles this path.
export {};
