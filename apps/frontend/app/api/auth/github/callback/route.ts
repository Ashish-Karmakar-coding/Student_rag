/**
 * apps/frontend/app/api/auth/github/callback/route.ts
 *
 * Receives GitHub's OAuth redirect at /api/auth/github/callback and
 * proxies it to NextAuth's native handler at /api/auth/callback/github.
 *
 * WHY: GitHub OAuth App is registered with /api/auth/github/callback.
 *      NextAuth's built-in catch-all listens at /api/auth/callback/github.
 *      We bridge the gap here.
 *
 * COOKIE FORWARDING: All headers (including the Cookie header) from the
 * browser's request are passed to the proxied request. This is essential —
 * NextAuth needs authjs.state and authjs.pkce.code_verifier cookies to
 * validate the OAuth flow. Without them, state validation fails.
 *
 * REDIRECT_URI: The custom token.request in auth.ts explicitly uses
 * /api/auth/github/callback as the redirect_uri for the token exchange,
 * so GitHub accepts the code exchange regardless of which path NextAuth
 * processes the callback on internally.
 */

import { handlers } from "@/auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Build the new URL pointing to NextAuth's native callback path.
  // Preserve all query parameters (code, state) that GitHub sent back.
  const url = new URL(request.url);
  url.pathname = "/api/auth/callback/github";

  // Copy ALL headers from the browser's original request.
  // The Cookie header contains authjs.state and authjs.pkce.code_verifier
  // which NextAuth needs to validate the OAuth state and PKCE flow.
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    headers.set(key, value);
  });

  const proxiedRequest = new NextRequest(url.toString(), {
    method: "GET",
    headers,
  });

  return handlers.GET(proxiedRequest);
}
