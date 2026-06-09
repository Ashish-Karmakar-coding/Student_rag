/**
 * apps/frontend/app/api/auth/github/callback/route.ts
 *
 * Native handler for the GitHub OAuth callback URL registered in the GitHub
 * OAuth App settings: /api/auth/github/callback
 *
 * NextAuth v5 only handles /api/auth/callback/github internally, so we rewrite
 * the incoming request URL before passing it to NextAuth's handler.
 *
 * CRITICAL: We must forward ALL headers (including Cookie) from the original
 * request. NextAuth uses cookies (authjs.state, authjs.pkce.code_verifier) to
 * validate the OAuth state parameter. Without forwarding them, state validation
 * fails and the user is sent to the error page (back to landing page).
 */
import { handlers } from "../../../../../auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Rewrite the URL path to what NextAuth v5 expects, preserving all query
  // params (code, state, etc.) that GitHub appends to the callback URL.
  const url = new URL(request.url);
  url.pathname = "/api/auth/callback/github";

  // Forward ALL original headers — this is essential so NextAuth can read the
  // authjs.state and authjs.pkce.code_verifier cookies it set during signIn().
  const rewrittenRequest = new NextRequest(url.toString(), {
    headers: request.headers, // includes Cookie header with OAuth state
    method: request.method,
  });

  return handlers.GET(rewrittenRequest);
}
