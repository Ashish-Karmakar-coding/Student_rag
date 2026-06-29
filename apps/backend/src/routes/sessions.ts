/**
 * apps/backend/src/routes/sessions.ts
 *
 * Session routes:
 *   GET    /sessions      → list sessions (no messages, most recent first)
 *   GET    /sessions/:id  → full session with all messages
 *   DELETE /sessions/:id  → delete session
 */

import { Hono } from "hono";
import { authMiddleware } from "../auth/middleware.js";
import { Session } from "../models/Session.js";

export const sessionRoutes = new Hono();

sessionRoutes.use("*", authMiddleware);

// ── GET /sessions ─────────────────────────────────────────────────────────────

sessionRoutes.get("/", async (c) => {
  const user = c.var.user;

  // Use aggregation to get message count without loading full message payloads
  const sessions = await Session.aggregate([
    { $match: { userId: user.githubId } },
    { $sort: { updatedAt: -1 } },
    { $limit: 50 },
    {
      $project: {
        subject: 1,
        createdAt: 1,
        updatedAt: 1,
        messageCount: { $size: "$messages" },
      },
    },
  ]);

  return c.json(
    sessions.map((s: any) => ({
      id: s._id.toString(),
      subject: s.subject,
      messageCount: s.messageCount as number,
      createdAt: new Date(s.createdAt).toISOString(),
      updatedAt: new Date(s.updatedAt).toISOString(),
    }))
  );
});

// ── GET /sessions/:id ─────────────────────────────────────────────────────────

sessionRoutes.get("/:id", async (c) => {
  const user = c.var.user;
  const { id } = c.req.param();

  let session;
  try {
    session = await Session.findOne({
      _id: id,
      userId: user.githubId, // enforce ownership
    }).lean();
  } catch {
    return c.json({ error: "Invalid session ID" }, 400);
  }

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({
    id: session._id.toString(),
    subject: session.subject,
    messages: session.messages.map((m, idx) => ({
      id: `${session._id.toString()}_${idx}`,
      role: m.role,
      text: m.text,
      conceptTags: m.conceptTags,
      sources: m.sources,
      isStreaming: false,
      timestamp: m.timestamp.toISOString(),
    })),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  });
});

// ── DELETE /sessions/:id ──────────────────────────────────────────────────────

sessionRoutes.delete("/:id", async (c) => {
  const user = c.var.user;
  const { id } = c.req.param();

  let result;
  try {
    result = await Session.deleteOne({
      _id: id,
      userId: user.githubId,
    });
  } catch {
    return c.json({ error: "Invalid session ID" }, 400);
  }

  if (result.deletedCount === 0) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({ ok: true });
});
