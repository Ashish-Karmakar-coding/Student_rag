/**
 * apps/frontend/app/api/backend/[...path]/route.ts
 *
 * Transparent proxy for backend API calls.
 * Next.js rewrites do NOT forward cookies to external domains.
 * This proxy manually forwards the request, including the Cookie header,
 * so the backend can authenticate the user via the access_token cookie.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

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
  // Next.js strips the host header when using fetch, but we can explicitly remove it just in case
  headers.delete("host");

  // Fetch from the backend
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    });

    // Forward the backend response
    const responseHeaders = new Headers(response.headers);
    
    // We don't want to forward backend's content-encoding if we are decoding it
    responseHeaders.delete("content-encoding");

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
    console.error("[Backend Proxy Error]", err);
    return NextResponse.json({ error: "Backend proxy failed" }, { status: 502 });
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
