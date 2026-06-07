/**
 * apps/frontend/app/api/auth/github/callback/route.ts
 *
 * Native handler for the GitHub OAuth callback URL registered in the GitHub
 * OAuth App settings: /api/auth/github/callback
 *
 * NextAuth v5 only handles /api/auth/callback/github internally, so we rewrite
 * the incoming request URL before passing it to NextAuth's handler.
 * This avoids an HTTP redirect (which could lose OAuth params in some clients).
 */
import { handlers } from "../../../../../auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Rewrite the URL path to what NextAuth v5 expects, preserving all query params
  // (code, state, etc.) that GitHub appends to the callback URL.
  const url = new URL(request.url);
  url.pathname = "/api/auth/callback/github";

  const rewrittenRequest = new NextRequest(url.toString(), {
    headers: request.headers,
  });

  return handlers.GET(rewrittenRequest);
}
