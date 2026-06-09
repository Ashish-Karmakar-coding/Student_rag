/**
 * apps/frontend/app/api/auth/github/callback/route.ts
 *
 * Receives GitHub's OAuth redirect at /api/auth/github/callback and
 * redirects the browser to NextAuth's native handler at /api/auth/callback/github.
 *
 * WHY: GitHub OAuth App is registered with /api/auth/github/callback.
 *      NextAuth's built-in catch-all listens at /api/auth/callback/github.
 *      By redirecting the browser, the browser naturally forwards its session cookies
 *      (like authjs.state and authjs.pkce.code_verifier) to the NextAuth handler.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  url.pathname = "/api/auth/callback/github";

  console.log("[auth-proxy] Redirecting callback to NextAuth handler:", url.toString());

  return NextResponse.redirect(url);
}
