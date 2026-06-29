/**
 * apps/frontend/app/api/backend/[...path]/route.ts
 *
 * Transparent proxy for backend API calls.
 * Next.js rewrites do NOT forward cookies to external domains.
 * This proxy manually forwards the request, including the Cookie header,
 * so the backend can authenticate the user via the access_token cookie.
 *
 * IMPORTANT: Must use Node.js runtime (not Edge) so multipart FormData
 * bodies can be fully buffered and forwarded to the backend.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env["BACKEND_INTERNAL_URL"] ??
  process.env["NEXT_PUBLIC_API_URL"] ??
  "http://localhost:8000";

async function proxyRequest(req: NextRequest, { params }: { params: { path: string[] } }) {
  // Construct the target URL
  const path = params.path.join("/");
  const url = new URL(req.url);
  const baseUrl = BACKEND_URL.replace(/\/$/, ""); // Strip trailing slash
  const targetUrl = `${baseUrl}/${path}${url.search}`;

  // Forward headers, explicitly including cookies
  const headers = new Headers(req.headers);
  // Remove host header — Vercel strips it but be explicit
  headers.delete("host");
  // Remove next.js internal headers that might confuse the backend
  headers.delete("x-nextjs-data");
  headers.delete("x-invoke-path");
  headers.delete("x-invoke-query");

  // Extract access_token from incoming request cookies and pass as Authorization header.
  // This is the primary auth mechanism — the backend's authMiddleware reads it from
  // the Authorization header when no cookie is present.
  const accessToken = req.cookies.get("access_token")?.value;
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  // Build the fetch options
  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  let body: ArrayBuffer | null = null;
  if (hasBody) {
    // Buffer the entire body — this handles both JSON and multipart FormData correctly.
    // For multipart uploads the Content-Type header (with boundary) is already in `headers`.
    body = await req.arrayBuffer();
  }

  // Fetch from the backend
  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
      body: hasBody && body ? body : undefined,
    };

    const response = await fetch(targetUrl, fetchOptions);

    // Build response headers — drop content-encoding since we decoded on the way
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");

    const nextResponse = new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

    // Handle Set-Cookie properly (Headers API might combine them incorrectly)
    responseHeaders.delete("set-cookie");
    if (typeof response.headers.getSetCookie === "function") {
      const cookies = response.headers.getSetCookie();
      for (const cookie of cookies) {
        nextResponse.headers.append("set-cookie", cookie);
      }
    } else {
      const cookieStr = response.headers.get("set-cookie");
      if (cookieStr) nextResponse.headers.set("set-cookie", cookieStr);
    }

    return nextResponse;
  } catch (err) {
    console.error("[Backend Proxy Error]", targetUrl, err);
    return NextResponse.json(
      { error: "Backend proxy failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
