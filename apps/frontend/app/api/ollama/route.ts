/**
 * apps/frontend/app/api/ollama/route.ts
 *
 * Local Ollama proxy — Codexa approach.
 *
 * WHY THIS EXISTS:
 * The Vercel backend runs in the cloud and cannot reach localhost:11434.
 * This route runs inside the Next.js server process, which runs on the USER'S
 * machine (in dev) or as a Vercel function (in production on Vercel).
 *
 * WAIT — doesn't this have the same problem on Vercel?
 * No, because this proxy is only called when provider === "ollama".
 * In that case, the user is expected to be running the app locally with
 * `npm run dev`, where the Next.js server IS on their machine.
 *
 * For production (Vercel-hosted frontend), users should switch to OpenAI or
 * Anthropic. But for local dev, this proxy lets the browser call Ollama
 * without CORS issues (browser → Next.js server → Ollama, all localhost).
 *
 * Alternatively, if OLLAMA_ORIGINS=* is set on the Ollama instance, the
 * browser can call Ollama directly. This proxy handles the case where it isn't.
 *
 * SUPPORTED ENDPOINTS:
 *   POST /api/ollama/generate  → proxies to http://localhost:{port}/api/generate
 *   POST /api/ollama/chat      → proxies to http://localhost:{port}/api/chat
 *   GET  /api/ollama/tags      → proxies to http://localhost:{port}/api/tags
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Default Ollama URL — can be overridden via env var for flexibility
const OLLAMA_BASE = process.env["OLLAMA_URL"] ?? "http://localhost:11434";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  // /api/ollama/generate → /api/generate
  // /api/ollama/chat     → /api/chat
  const pathSuffix = url.pathname.replace(/^\/api\/ollama/, "");
  const targetUrl = `${OLLAMA_BASE}/api${pathSuffix}`;

  try {
    const body = await req.arrayBuffer();
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    // Stream the response back to the browser
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
        "Transfer-Encoding": "chunked",
        // Allow browser to read the response
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Ollama Proxy]", targetUrl, msg);
    return NextResponse.json(
      {
        error: "Could not reach Ollama",
        detail: msg,
        hint: `Make sure Ollama is running locally. Check that it is listening on ${OLLAMA_BASE}`,
      },
      { status: 503 }
    );
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const pathSuffix = url.pathname.replace(/^\/api\/ollama/, "");
  const targetUrl = `${OLLAMA_BASE}/api${pathSuffix}`;

  try {
    const response = await fetch(targetUrl);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Could not reach Ollama", detail: msg },
      { status: 503 }
    );
  }
}
