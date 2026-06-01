/**
 * apps/backend/src/routes/mastery.ts
 *
 * Mastery routes:
 *   GET   /mastery                   → all concepts sorted weak-first
 *   GET   /mastery/summary           → aggregate stats
 *   PATCH /mastery/:concept/reset    → reset concept score to 0.5
 */

import { Hono } from "hono";
import { authMiddleware } from "../auth/middleware.js";
import { Mastery } from "../models/Mastery.js";
import { Session } from "../models/Session.js";

export const masteryRoutes = new Hono();

masteryRoutes.use("*", authMiddleware);

// ── GET /mastery ──────────────────────────────────────────────────────────────

masteryRoutes.get("/", async (c) => {
  const user = c.var.user;

  const docs = await Mastery.find({ userId: user.githubId })
    .sort({ score: 1 }) // weak-first
    .lean();

  return c.json(
    docs.map((d) => ({
      concept: d.concept,
      subject: d.subject,
      score: d.score,
      attemptCount: d.attemptCount,
      correctCount: d.correctCount,
      lastTested: d.lastTested?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    }))
  );
});

// ── GET /mastery/summary ──────────────────────────────────────────────────────

masteryRoutes.get("/summary", async (c) => {
  const user = c.var.user;

  const docs = await Mastery.find({ userId: user.githubId }).lean();

  if (docs.length === 0) {
    return c.json({
      overallPct: 0,
      masteredCount: 0,
      weakCount: 0,
      totalCount: 0,
      sessionsThisWeek: 0,
      streakDays: 0,
    });
  }

  const totalCount = docs.length;
  const masteredCount = docs.filter((d) => d.score >= 0.7).length;
  const weakCount = docs.filter((d) => d.score < 0.35).length;
  const overallPct = Math.round(
    (docs.reduce((sum, d) => sum + d.score, 0) / totalCount) * 100
  );

  // Sessions this week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sessionsThisWeek = await Session.countDocuments({
    userId: user.githubId,
    createdAt: { $gte: weekAgo },
  });

  // Streak days: count consecutive days with at least one mastery update
  const recentActivity = docs
    .filter((d) => d.lastTested !== null)
    .map((d) => d.lastTested!)
    .sort((a, b) => b.getTime() - a.getTime());

  let streakDays = 0;
  if (recentActivity.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const uniqueDays = new Set(
      recentActivity.map((d) => {
        const day = new Date(d);
        day.setHours(0, 0, 0, 0);
        return day.getTime();
      })
    );

    let currentDay = today.getTime();
    for (let i = 0; i <= 365; i++) {
      if (uniqueDays.has(currentDay)) {
        streakDays++;
        currentDay -= 24 * 60 * 60 * 1000;
      } else if (i === 0) {
        // Today has no activity — check yesterday
        currentDay -= 24 * 60 * 60 * 1000;
      } else {
        break;
      }
    }
  }

  return c.json({
    overallPct,
    masteredCount,
    weakCount,
    totalCount,
    sessionsThisWeek,
    streakDays,
  });
});

// ── PATCH /mastery/:concept/reset ─────────────────────────────────────────────

masteryRoutes.patch("/:concept/reset", async (c) => {
  const user = c.var.user;
  const { concept } = c.req.param();

  if (!concept) {
    return c.json({ error: "concept is required" }, 400);
  }

  const result = await Mastery.updateOne(
    { userId: user.githubId, concept: decodeURIComponent(concept) },
    {
      $set: {
        score: 0.5,
        attemptCount: 0,
        correctCount: 0,
        lastTested: null,
      },
    }
  );

  if (result.matchedCount === 0) {
    return c.json({ error: `Concept "${concept}" not found` }, 404);
  }

  return c.json({ ok: true, concept, resetTo: 0.5 });
});
