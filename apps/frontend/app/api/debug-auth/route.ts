/**
 * Diagnostic endpoint to check auth configuration at runtime.
 * Hit GET /api/debug-auth to see if all env vars are properly set on Vercel.
 * DELETE THIS FILE after debugging is complete.
 */
import { NextResponse } from "next/server";

export async function GET() {
  const authSecret = process.env.AUTH_SECRET;
  const nextauthSecret = process.env.NEXTAUTH_SECRET;
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
  const nextauthUrl = process.env.NEXTAUTH_URL;
  const authTrustHost = process.env.AUTH_TRUST_HOST;
  const authUrl = process.env.AUTH_URL;
  const nodeEnv = process.env.NODE_ENV;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: {
      AUTH_SECRET: authSecret ? `SET (${authSecret.length} chars)` : "❌ MISSING",
      NEXTAUTH_SECRET: nextauthSecret ? `SET (${nextauthSecret.length} chars)` : "❌ MISSING",
      GITHUB_CLIENT_ID: githubClientId ? `SET (${githubClientId.length} chars)` : "❌ MISSING",
      GITHUB_CLIENT_SECRET: githubClientSecret ? `SET (${githubClientSecret.length} chars)` : "❌ MISSING",
      NEXTAUTH_URL: nextauthUrl ?? "❌ MISSING",
      AUTH_URL: authUrl ?? "not set (optional)",
      AUTH_TRUST_HOST: authTrustHost ?? "not set",
      NODE_ENV: nodeEnv ?? "not set",
    },
    checks: {
      secretsMatch: authSecret && nextauthSecret
        ? authSecret === nextauthSecret ? "✅ MATCH" : "⚠️ DIFFERENT VALUES"
        : "N/A (one or both missing)",
      hasRequiredVars: !!(authSecret || nextauthSecret) && !!githubClientId && !!githubClientSecret,
    },
  });
}
