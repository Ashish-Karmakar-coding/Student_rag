/**
 * apps/backend/src/routes/chat.ts
 *
 * Chat route:
 *   POST /chat → text/event-stream (Hono streamSSE)
 *
 * SSE event types emitted:
 *   { type: "chunk",        text: string }
 *   { type: "concept_tags", tags: string[] }
 *   { type: "sources",      chunks: Source[] }
 *   { type: "mastery_hint", weakConcept: string, score: number }
 *   { type: "done" }
 *   { type: "error",        message: string }
 *
 * After the stream closes, the full exchange is persisted to MongoDB.
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { ChatRequestSchema } from "@study-tutor/shared";
import { authMiddleware } from "../auth/middleware.js";
import { runTutorGraph } from "../graph/tutorGraph.js";
import { findWeakestConcept } from "../retrieval/masteryWeighter.js";
import { Session } from "../models/Session.js";

export const chatRoutes = new Hono();

chatRoutes.use("*", authMiddleware);

// ── POST /chat ────────────────────────────────────────────────────────────────

chatRoutes.post("/chat", async (c) => {
  const user = c.var.user;

  // Validate request body
  const bodyResult = ChatRequestSchema.safeParse(await c.req.json());
  if (!bodyResult.success) {
    return c.json(
      { error: "Invalid request", details: bodyResult.error.flatten() },
      400
    );
  }

  const { query, mode, subject } = bodyResult.data;

  if (!user.hasFiles) {
    return c.json(
      { error: "No study materials uploaded. Please upload files first." },
      400
    );
  }

  // ── SSE stream ──────────────────────────────────────────────────────────────

  return streamSSE(c, async (stream) => {
    let fullResponse = "";
    let graphState;

    try {
      // Stream callback: called by generate node for each token
      const streamCallback = (token: string) => {
        stream
          .writeSSE({
            data: JSON.stringify({ type: "chunk", text: token }),
          })
          .catch(console.error);
        fullResponse += token;
      };

      // Run the LangGraph
      graphState = await runTutorGraph({
        userId: user.githubId,
        mode,
        query,
        providerConfig: { ...user.providerConfig, userId: user.githubId },
        streamCallback,
      });

      // Emit concept tags from retrieved chunks
      const conceptTags = [
        ...new Set(
          graphState.retrievedChunks.flatMap(
            (c) => c.metadata?.conceptTags ?? []
          )
        ),
      ];

      await stream.writeSSE({
        data: JSON.stringify({ type: "concept_tags", tags: conceptTags }),
      });

      // Emit source citations
      const sources = graphState.retrievedChunks.map((chunk) => ({
        fileName: chunk.metadata?.fileName ?? "",
        chunkIndex: chunk.metadata?.chunkIndex ?? 0,
        page: chunk.metadata?.page,
      }));

      await stream.writeSSE({
        data: JSON.stringify({ type: "sources", chunks: sources }),
      });

      // Emit mastery hint (weakest concept in this context)
      if (Object.keys(graphState.masteryContext).length > 0) {
        const { concept: weakConcept, score } = findWeakestConcept(
          graphState.masteryContext
        );
        await stream.writeSSE({
          data: JSON.stringify({
            type: "mastery_hint",
            weakConcept,
            score,
          }),
        });
      }

      // Done signal
      await stream.writeSSE({ data: JSON.stringify({ type: "done" }) });

      // ── Persist session to MongoDB ─────────────────────────────────────────
      const sessionSubject = subject ?? graphState.retrievedChunks[0]?.metadata?.subject ?? "general";
      const sessionSources = sources.slice(0, 6);

      await Session.findOneAndUpdate(
        {
          userId: user.githubId,
          // Find existing session updated in the last 30 min to group messages
          updatedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
          subject: sessionSubject,
        },
        {
          $push: {
            messages: {
              $each: [
                {
                  role: "user",
                  text: query,
                  conceptTags: [],
                  sources: [],
                  timestamp: new Date(),
                },
                {
                  role: "assistant",
                  text: fullResponse,
                  conceptTags,
                  sources: sessionSources,
                  timestamp: new Date(),
                },
              ],
            },
          },
          $setOnInsert: {
            userId: user.githubId,
            subject: sessionSubject,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[chat] Error:", message);
      await stream
        .writeSSE({
          data: JSON.stringify({ type: "error", message }),
        })
        .catch(() => {});
    }
  });
});
