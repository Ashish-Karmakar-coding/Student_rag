/**
 * apps/backend/src/routes/quiz.ts
 *
 * Quiz routes:
 *   GET  /quiz/next    → generate next Socratic question
 *   POST /quiz/answer  → evaluate answer, update mastery, return feedback
 *
 * Pending quiz questions are stored in a short-lived in-memory cache (Map).
 * TTL: 10 minutes. Cleaned up via setInterval every 5 minutes.
 * This avoids a separate DB collection for ephemeral quiz state.
 */

import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { QuizAnswerSchema, QuizNextQuerySchema } from "@study-tutor/shared";
import { authMiddleware } from "../auth/middleware.js";
import { Mastery, calcNewMasteryScore } from "../models/Mastery.js";
import { IngestJob, type IIngestFile } from "../models/IngestJob.js";
import { retrieve } from "../retrieval/retrieve.js";
import { getQueryEmbeddingProvider, getLLMProvider } from "../providers/factory.js";
import {
  buildSocraticPrompt,
  SOCRATIC_SYSTEM,
  parseSocraticResponse,
  getDifficulty,
} from "../generation/socratic.js";
import { evaluateAnswer } from "../generation/evaluator.js";
import type { RetrievedChunk } from "../retrieval/hybrid.js";

export const quizRoutes = new Hono();

quizRoutes.use("*", authMiddleware);

// ── Pending question cache ────────────────────────────────────────────────────

interface PendingQuestion {
  userId: string;
  concept: string;
  question: string;
  hint: string;
  masteryBefore: number;
  chunks: RetrievedChunk[];
  expiresAt: number;
}

const pendingQuestions = new Map<string, PendingQuestion>();

// TTL cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, q] of pendingQuestions.entries()) {
    if (q.expiresAt < now) pendingQuestions.delete(id);
  }
}, 5 * 60 * 1000);

const QUESTION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── GET /quiz/next ────────────────────────────────────────────────────────────

quizRoutes.get("/next", async (c) => {
  const user = c.var.user;

  const queryResult = QuizNextQuerySchema.safeParse(
    Object.fromEntries(new URL(c.req.url).searchParams)
  );
  if (!queryResult.success) {
    return c.json({ error: "Invalid query params" }, 400);
  }

  const { concept: requestedConcept, subject, fileName } = queryResult.data;

  // 1. Find the target concept (requested or weakest)
  let targetConcept: string;
  let masteryBefore: number;

  if (requestedConcept) {
    const doc = await Mastery.findOne({
      userId: user.githubId,
      concept: requestedConcept,
    }).lean();
    targetConcept = requestedConcept;
    masteryBefore = doc?.score ?? 0.5;
  } else if (fileName) {
    // Target by File
    const jobs = await IngestJob.find({ 
      userId: user.githubId, 
      "files.fileName": fileName 
    }).lean();
    
    const fileConcepts = new Set<string>();
    for (const job of jobs) {
      const fileInfo = job.files.find((f: IIngestFile) => f.fileName === fileName);
      if (fileInfo?.conceptsFound) {
        fileInfo.conceptsFound.forEach((c: string) => fileConcepts.add(c));
      }
    }
    
    if (fileConcepts.size === 0) {
      return c.json({ error: `No concepts found for file: ${fileName}` }, 404);
    }
    
    const weakest = await Mastery.findOne({ 
      userId: user.githubId, 
      concept: { $in: Array.from(fileConcepts) } 
    }).sort({ score: 1 }).lean();
    
    if (!weakest) {
      targetConcept = Array.from(fileConcepts)[0] as string;
      masteryBefore = 0.5;
    } else {
      targetConcept = weakest.concept;
      masteryBefore = weakest.score;
    }
  } else {
    // Find weakest concept for this user (optionally filtered by subject)
    const query: Record<string, unknown> = { userId: user.githubId };
    if (subject) query["subject"] = subject;

    const weakest = await Mastery.findOne(query)
      .sort({ score: 1 })
      .lean();

    if (!weakest) {
      return c.json(
        { error: "No mastery data found. Upload study materials first." },
        404
      );
    }
    targetConcept = weakest.concept;
    masteryBefore = weakest.score;
  }

  // 2. Retrieve relevant chunks for this concept
  const embedder = getQueryEmbeddingProvider({
    ...user.providerConfig,
    userId: user.githubId,
  });

  const { chunks } = await retrieve(targetConcept, user.githubId, embedder, fileName);

  if (chunks.length === 0) {
    return c.json(
      { error: `No content found for concept: ${targetConcept}` },
      404
    );
  }

  // 3. Generate Socratic question
  const llm = getLLMProvider({ ...user.providerConfig, userId: user.githubId });
  const prompt = buildSocraticPrompt(targetConcept, masteryBefore, chunks);
  const rawResponse = await llm.complete(prompt, SOCRATIC_SYSTEM);
  const { question, hint } = parseSocraticResponse(rawResponse);

  // 4. Store in pending cache
  const questionId = uuidv4();
  pendingQuestions.set(questionId, {
    userId: user.githubId,
    concept: targetConcept,
    question,
    hint,
    masteryBefore,
    chunks,
    expiresAt: Date.now() + QUESTION_TTL_MS,
  });

  const difficulty = getDifficulty(masteryBefore);

  return c.json({
    questionId,
    question,
    concept: targetConcept,
    masteryBefore,
    difficulty,
    hint,
    sources: chunks.slice(0, 3).map((ch) => ({
      fileName: ch.metadata?.fileName ?? "",
      chunkIndex: ch.metadata?.chunkIndex ?? 0,
      page: ch.metadata?.page,
    })),
  });
});

// ── POST /quiz/answer ─────────────────────────────────────────────────────────

quizRoutes.post("/answer", async (c) => {
  const user = c.var.user;

  const bodyResult = QuizAnswerSchema.safeParse(await c.req.json());
  if (!bodyResult.success) {
    return c.json(
      { error: "Invalid request", details: bodyResult.error.flatten() },
      400
    );
  }

  const { questionId, answer } = bodyResult.data;

  // Retrieve pending question
  const pending = pendingQuestions.get(questionId);

  if (!pending) {
    return c.json(
      { error: "Question not found or expired. Please request a new question." },
      404
    );
  }

  // Enforce ownership
  if (pending.userId !== user.githubId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  // Clean up immediately after retrieval
  pendingQuestions.delete(questionId);

  // 1. Evaluate answer
  const llm = getLLMProvider({ ...user.providerConfig, userId: user.githubId });
  const evalResult = await evaluateAnswer(
    pending.question,
    answer,
    pending.chunks,
    llm
  );

  // 2. Update mastery
  const oldScore = pending.masteryBefore;
  const newScore = calcNewMasteryScore(oldScore, evalResult.score);

  await Mastery.updateOne(
    { userId: user.githubId, concept: pending.concept },
    {
      $set: { score: newScore, lastTested: new Date() },
      $inc: {
        attemptCount: 1,
        correctCount: evalResult.score > 0.6 ? 1 : 0,
      },
    },
    { upsert: true }
  );

  return c.json({
    score: evalResult.score,
    feedback: evalResult.feedback,
    explanation: evalResult.explanation,
    masteryBefore: oldScore,
    masteryAfter: newScore,
    delta: Number((newScore - oldScore).toFixed(4)),
  });
});
