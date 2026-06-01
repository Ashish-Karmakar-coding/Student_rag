/**
 * apps/frontend/app/api/sync-user/route.ts
 *
 * Called by the client immediately after a successful GitHub sign-in.
 * Flow:
 *   1. Get the NextAuth session (server-side)
 *   2. Forward user data to the backend POST /auth/sync with the session token
 *   3. Backend verifies the token, upserts the user, returns Set-Cookie
 *   4. Mirror the backend's access_token cookie to this response
 *
 * The client calls this route via a useEffect after session is established.
 */

import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { encode } from "next-auth/jwt";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";
const NEXTAUTH_SECRET = process.env["NEXTAUTH_SECRET"]!;

export async function POST(): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { githubId, login, avatarUrl, email } = session.user;

    // Create a short-lived JWT the backend can verify (NEXTAUTH_SECRET)
    const token = await encode({
      token: {
        sub: githubId,
        githubId,
        login,
        avatarUrl,
        email: email ?? null,
      },
      secret: NEXTAUTH_SECRET,
      salt: "authjs.session-token",
    });

    // POST to the backend
    const backendRes = await fetch(`${API_URL}/auth/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ githubId, login, avatarUrl, email: email ?? null }),
    });

    if (!backendRes.ok) {
      const err = await backendRes.json().catch(() => ({ error: "Unknown" }));
      return NextResponse.json(err, { status: backendRes.status });
    }

    const data = await backendRes.json() as { ok: boolean };

    // Mirror the backend's Set-Cookie header (access_token)
    const response = NextResponse.json(data);
    const setCookie = backendRes.headers.get("set-cookie");
    if (setCookie) {
      response.headers.set("set-cookie", setCookie);
    }

    return response;
  } catch (err) {
    console.error("[sync-user]", err);
    return NextResponse.json(
      { error: "Sync failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
