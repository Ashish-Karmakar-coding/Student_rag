/**
 * apps/backend/src/auth/jwt.ts
 *
 * Backend JWT helpers using the `jose` library (used internally by hono/jwt).
 * Two token types:
 *  1. Backend JWT  — signed with APP_SECRET, set as HTTP-only cookie
 *  2. NextAuth JWT — signed with NEXTAUTH_SECRET, used only in /auth/sync
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config.js";

const BACKEND_SECRET = new TextEncoder().encode(env.APP_SECRET);
const NEXTAUTH_SECRET = new TextEncoder().encode(env.NEXTAUTH_SECRET);

const BACKEND_ISSUER = "study-tutor-backend";

// ── Payload shapes ────────────────────────────────────────────────────────────

export interface BackendJWTPayload extends JWTPayload {
  sub: string;   // githubId
  login: string;
}

export interface NextAuthJWTPayload extends JWTPayload {
  sub?: string;  // may be absent on very early tokens
  githubId?: string;
  login?: string;
  avatarUrl?: string;
  email?: string | null;
}

// ── Backend JWT ───────────────────────────────────────────────────────────────

/** Signs a new backend JWT valid for 7 days. */
export async function signBackendToken(
  githubId: string,
  login: string
): Promise<string> {
  return new SignJWT({ login } satisfies Omit<BackendJWTPayload, keyof JWTPayload>)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(githubId)
    .setIssuer(BACKEND_ISSUER)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(BACKEND_SECRET);
}

/** Verifies a backend JWT and returns its payload. Throws on invalid token. */
export async function verifyBackendToken(
  token: string
): Promise<BackendJWTPayload> {
  const { payload } = await jwtVerify(token, BACKEND_SECRET, {
    issuer: BACKEND_ISSUER,
  });
  return payload as BackendJWTPayload;
}

// ── NextAuth JWT (incoming from frontend) ─────────────────────────────────────

/**
 * Verifies a NextAuth JWT passed by the frontend /api/sync-user route.
 * NextAuth v5 signs its token with NEXTAUTH_SECRET.
 * We don't verify the issuer strictly — NextAuth v5 sometimes omits it.
 */
export async function verifyNextAuthToken(
  token: string
): Promise<NextAuthJWTPayload> {
  const { payload } = await jwtVerify(token, NEXTAUTH_SECRET);
  return payload as NextAuthJWTPayload;
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

/** The cookie name used for the backend JWT. */
export const ACCESS_TOKEN_COOKIE = "access_token";

/** Returns standard cookie options for the backend JWT cookie. */
export function cookieOptions(isDev: boolean) {
  return {
    httpOnly: true,
    sameSite: "Lax" as const,
    path: "/",
    secure: !isDev,
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  };
}
