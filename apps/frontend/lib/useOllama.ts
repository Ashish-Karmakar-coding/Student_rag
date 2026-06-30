/**
 * apps/frontend/lib/useOllama.ts
 *
 * Browser-side Ollama client — Codexa approach.
 *
 * Calls the local /api/ollama proxy which forwards to localhost:11434.
 * This mirrors how Codexa's ollamaService.ts works:
 *   browser → /api/ollama/generate → Next.js server → localhost:11434
 *
 * Used by the chat and quiz pages when provider === "ollama".
 * Keeps cloud providers (OpenAI, Anthropic) going through the Vercel backend
 * as before — only Ollama uses this client-side path.
 */

"use client";

// The local Ollama proxy lives at /api/ollama (Next.js route)
const OLLAMA_PROXY = "/api/ollama";

export interface OllamaChunk {
  response?: string;   // /api/generate streaming format
  message?: { content: string }; // /api/chat streaming format
  done: boolean;
}

/**
 * Calls local Ollama and returns the full response text.
 * Non-streaming — used by quiz question generation and answer evaluation.
 */
export async function ollamaComplete(
  prompt: string,
  system: string,
  model: string,
  ollamaPort: string = "11434"
): Promise<string> {
  // Use the proxy for browser → Next.js server → Ollama (avoids CORS)
  // In dev this is fine. In production users should run locally.
  const url = `${OLLAMA_PROXY}/generate`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      system,
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as any).error ??
      (err as any).detail ??
      `Ollama returned ${response.status}. Make sure Ollama is running on port ${ollamaPort}.`
    );
  }

  const data = await response.json();
  return (data.response as string) ?? "";
}

/**
 * Calls local Ollama and streams response tokens.
 * Used by the chat page for real-time streaming output — mirrors useStream.ts
 * but routes through the local Ollama proxy instead of Vercel backend.
 */
export async function* ollamaStream(
  prompt: string,
  system: string,
  model: string
): AsyncGenerator<string> {
  const url = `${OLLAMA_PROXY}/generate`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      system,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as any).error ??
      (err as any).detail ??
      `Ollama returned ${response.status}. Make sure Ollama is running.`
    );
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Ollama: no response body");

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as OllamaChunk;
        if (parsed.response) yield parsed.response;
        if (parsed.done) return;
      } catch {
        // partial JSON line — skip
      }
    }
  }
}

/**
 * Pings local Ollama to check if it's running.
 * Returns true if reachable, false otherwise.
 */
export async function pingOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_PROXY}/tags`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
