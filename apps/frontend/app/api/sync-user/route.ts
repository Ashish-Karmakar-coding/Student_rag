/**
 * apps/frontend/app/api/sync-user/route.ts
 *
 * Called by the client immediately after a successful GitHub sign-in.
 * Flow:
 *   1. Get the NextAuth session (server-side)
 *   2. Forward user data to the EXTERNAL backend POST /auth/sync with the session token
 *   3. Backend verifies the token, upserts the user, returns Set-Cookie
 *   4. Mirror the backend's access_token cookie to this response
 *
 * The client calls this route via a useEffect after session is established.
 *
 * IMPORTANT: In production, NEXT_PUBLIC_API_URL must point to the backend's
 * external URL (e.g. https://api.yourdomain.com).
 */

import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { SignJWT } from "jose";
import axios, { AxiosResponse } from "axios";

// Backend URL — must be the external backend API URL in production
// e.g. https://api.yourdomain.com
const BACKEND_URL =
  process.env["BACKEND_INTERNAL_URL"] ??
  process.env["NEXT_PUBLIC_API_URL"] ??
  "http://localhost:8000";

const NEXTAUTH_SECRET = new TextEncoder().encode(process.env["NEXTAUTH_SECRET"]!);

export async function POST(): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { githubId, login, avatarUrl, email } = session.user;

    // Create a short-lived JWS the backend can verify (NEXTAUTH_SECRET)
    const token = await new SignJWT({
      sub: githubId,
      githubId,
      login,
      avatarUrl,
      email: email || null,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(NEXTAUTH_SECRET);

    // POST to the external backend
    console.log("[sync-user] Sending token to backend at:", BACKEND_URL);

    let backendRes: AxiosResponse<{ ok: boolean; token?: string }>;
    try {
      backendRes = await axios.post<{ ok: boolean; token?: string }>(`${BACKEND_URL}/auth/sync`, {
        githubId, login, avatarUrl, email: email || null
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err: any) {
      console.error("[sync-user] Backend rejected sync:", err.response?.status);
      console.error("[sync-user] Backend error body:", err.response?.data);
      return NextResponse.json(err.response?.data ?? { error: "Unknown" }, { status: err.response?.status ?? 500 });
    }

    const data = backendRes.data;
    console.log("[sync-user] Backend sync success:", data);

    // If the backend returns a token, set it explicitly using Next.js cookies API.
    // This is much more reliable than forwarding Set-Cookie headers via Axios.
    if (data.token) {
      const { cookies } = await import("next/headers");
      const cookieStore = cookies();
      cookieStore.set("access_token", data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[sync-user]", err);
    return NextResponse.json(
      { error: "Sync failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}