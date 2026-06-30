/**
 * apps/backend/src/routes/quiz.ts
 *
 * Quiz routes:
 *   GET  /quiz/next    → generate next Socratic question
 *   POST /quiz/answer  → evaluate answer, update mastery, return feedback
 *
 * SERVERLESS-SAFE DESIGN:
 * Pending quiz questions are stored in MongoDB (PendingQuestion collection)
 * with a TTL index for automatic cleanup after 10 minutes.
 *
 * Previously, an in-memory Map was used — this BREAKS on Vercel serverless
 * because each function invocation is a fresh process. A question created
 * in one invocation is NEVER visible to the next invocation handling /quiz/answer.
 * MongoDB solves this by persisting across invocations.
 *
 * The setInterval TTL cleanup was also removed — it does not fire on serverless
 * functions and causes issues during cold starts. MongoDB's TTL index handles
 * cleanup automatically.
 */

import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { QuizAnswerSchema, QuizNextQuerySchema } from "@study-tutor/shared";
import { authMiddleware } from "../auth/middleware.js";
import { Mastery, calcNewMasteryScore } from "../models/Mastery.js";
import { IngestJob, type IIngestFile } from "../models/IngestJob.js";
import { PendingQuestion } from "../models/PendingQuestion.js";
import { retrieve } from "../retrieval/retrieve.js";
import { getQueryEmbeddingProvider, getLLMProvider, isProviderReachable } from "../providers/factory.js";
import {
  buildSocraticPrompt,
  SOCRATIC_SYSTEM,
  parseSocraticResponse,
  getDifficulty,
} from "../generation/socratic.js";
import { evaluateAnswer } from "../generation/evaluator.js";
import type { RetrievedChunk } from "../retrieval/hybrid.js";
import { ProviderError, ProviderAuthError } from "../providers/base.js";

export const quizRoutes = new Hono();

quizRoutes.use("*", authMiddleware);

/** TTL: questions expire after 10 minutes */
const QUESTION_TTL_MS = 10 * 60 * 1000;

// ── GET /quiz/next ────────────────────────────────────────────────────────────

quizRoutes.get("/next", async (c) => {
  const user = c.var.user;

  try {
    const queryResult = QuizNextQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams)
    );
    if (!queryResult.success) {
      return c.json({ error: "Invalid query params" }, 400);
    }

    const { concept: requestedConcept, subject, fileName } = queryResult.data;

    // ── Pre-flight: check LLM provider is reachable ──────────────────────────
    // Do this early so we fail fast with a clear message instead of waiting
    // for Pinecone retrieval only to fail at the LLM step.
    const cfg = { ...user.providerConfig, userId: user.githubId };
    const llmReachable = await isProviderReachable(cfg);

    if (!llmReachable) {
      return c.json(
        {
          error: `LLM provider unavailable`,
          message:
            `Quiz generation requires an LLM. Your current provider (${cfg.provider}) ` +
            `is not reachable from the server. Go to Settings → switch to OpenAI or Anthropic ` +
            `and save your API key.`,
          hint: "settings",
        },
        503
      );
    }

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
        "files.fileName": fileName,
      }).lean();

      const fileConcepts = new Set<string>();
      for (const job of jobs) {
        const fileInfo = job.files.find((f: IIngestFile) => f.fileName === fileName);
        if (fileInfo?.conceptsFound) {
          fileInfo.conceptsFound.forEach((concept: string) => fileConcepts.add(concept));
        }
      }

      if (fileConcepts.size === 0) {
        return c.json(
          { error: `No concepts found for file: ${fileName}. The file may still be processing or failed to index.` },
          404
        );
      }

      const weakest = await Mastery.findOne({
        userId: user.githubId,
        concept: { $in: Array.from(fileConcepts) },
      })
        .sort({ score: 1 })
        .lean();

      if (!weakest) {
        targetConcept = Array.from(fileConcepts)[0] as string;
        masteryBefore = 0.5;
      } else {
        targetConcept = weakest.concept;
        masteryBefore = weakest.score;
      }
    } else {
      const query: Record<string, unknown> = { userId: user.githubId };
      if (subject) query["subject"] = subject;

      const weakest = await Mastery.findOne(query).sort({ score: 1 }).lean();

      if (!weakest) {
        return c.json(
          { error: "No mastery data found. Upload study materials first." },
          404
        );
      }
      targetConcept = weakest.concept;
      masteryBefore = weakest.score;
    }

    // 2. Retrieve relevant chunks (Pinecone)

    const embedder = getQueryEmbeddingProvider({
      ...user.providerConfig,
      userId: user.githubId,
    });

    let chunks: RetrievedChunk[];
    try {
      const result = await retrieve(targetConcept, user.githubId, embedder, fileName);
      chunks = result.chunks;
    } catch (retrieveErr) {
      if (retrieveErr instanceof ProviderAuthError || retrieveErr instanceof ProviderError) {
        throw retrieveErr;
      }
      const msg = retrieveErr instanceof Error ? retrieveErr.message : String(retrieveErr);
      console.error("[quiz/next] Pinecone retrieve failed:", msg);
      return c.json(
        {
          error: `Failed to retrieve study content: ${msg}`,
          hint: "Ensure your Pinecone index exists and has been indexed with study materials.",
        },
        503
      );
    }

    if (chunks.length === 0) {
      return c.json(
        { error: `No content found for concept: "${targetConcept}". Upload and index the file first.` },
        404
      );
    }

    // 3. Generate Socratic question via LLM
    const llm = getLLMProvider(cfg);
    const prompt = buildSocraticPrompt(targetConcept, masteryBefore, chunks);
    const rawResponse = await llm.complete(prompt, SOCRATIC_SYSTEM);
    const { question, hint } = parseSocraticResponse(rawResponse);

    // 4. Persist pending question in MongoDB (serverless-safe)
    //    TTL index on `expiresAt` auto-deletes after 10 minutes.
    const questionId = uuidv4();
    await PendingQuestion.create({
      questionId,
      userId: user.githubId,
      concept: targetConcept,
      question,
      hint,
      masteryBefore,
      chunksJson: JSON.stringify(chunks),
      expiresAt: new Date(Date.now() + QUESTION_TTL_MS),
    });

    return c.json({
      questionId,
      question,
      concept: targetConcept,
      masteryBefore,
      difficulty: getDifficulty(masteryBefore),
      hint,
      sources: chunks.slice(0, 3).map((ch) => ({
        fileName: ch.metadata?.fileName ?? "",
        chunkIndex: ch.metadata?.chunkIndex ?? 0,
        page: ch.metadata?.page,
      })),
    });
  } catch (err) {
    if (err instanceof ProviderAuthError) {
      return c.json({ error: `Authentication failed: ${err.message}` }, 401);
    }
    if (err instanceof ProviderError) {
      return c.json({ error: `Provider error: ${err.message}` }, 503);
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[quiz/next] Unhandled error:", msg);
    return c.json({ error: `Internal server error: ${msg}` }, 500);
  }
});

// ── GET /quiz/next-context ────────────────────────────────────────────────────
// Codexa approach: retrieve chunks and concept target only, no LLM.
// Frontend uses this to get context, then calls local Ollama directly.

quizRoutes.get("/next-context", async (c) => {
  const user = c.var.user;

  try {
    const queryResult = QuizNextQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams)
    );
    if (!queryResult.success) {
      return c.json({ error: "Invalid query params" }, 400);
    }

    const { concept: requestedConcept, subject, fileName } = queryResult.data;

    let targetConcept: string;
    let masteryBefore: number;

    if (requestedConcept) {
      const doc = await Mastery.findOne({ userId: user.githubId, concept: requestedConcept }).lean();
      targetConcept = requestedConcept;
      masteryBefore = doc?.score ?? 0.5;
    } else if (fileName) {
      const jobs = await IngestJob.find({ userId: user.githubId, "files.fileName": fileName }).lean();
      const fileConcepts = new Set<string>();
      for (const job of jobs) {
        const fileInfo = job.files.find((f: IIngestFile) => f.fileName === fileName);
        if (fileInfo?.conceptsFound) {
          fileInfo.conceptsFound.forEach((concept: string) => fileConcepts.add(concept));
        }
      }
      if (fileConcepts.size === 0) {
        return c.json({ error: `No concepts found for file: ${fileName}` }, 404);
      }
      const weakest = await Mastery.findOne({ userId: user.githubId, concept: { $in: Array.from(fileConcepts) } })
        .sort({ score: 1 }).lean();
      if (!weakest) {
        targetConcept = Array.from(fileConcepts)[0] as string;
        masteryBefore = 0.5;
      } else {
        targetConcept = weakest.concept;
        masteryBefore = weakest.score;
      }
    } else {
      const query: Record<string, unknown> = { userId: user.githubId };
      if (subject) query["subject"] = subject;
      const weakest = await Mastery.findOne(query).sort({ score: 1 }).lean();
      if (!weakest) {
        return c.json({ error: "No mastery data found. Upload study materials first." }, 404);
      }
      targetConcept = weakest.concept;
      masteryBefore = weakest.score;
    }

    const embedder = getQueryEmbeddingProvider({ ...user.providerConfig, userId: user.githubId });
    let chunks: RetrievedChunk[];
    try {
      const result = await retrieve(targetConcept, user.githubId, embedder, fileName);
      chunks = result.chunks;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: `Retrieve failed: ${msg}` }, 503);
    }

    if (chunks.length === 0) {
      return c.json({ error: `No content found for concept: "${targetConcept}"` }, 404);
    }

    return c.json({
      concept: targetConcept,
      masteryBefore,
      difficulty: getDifficulty(masteryBefore),
      chunks,
      sources: chunks.slice(0, 3).map((ch) => ({
        fileName: ch.metadata?.fileName ?? "",
        chunkIndex: ch.metadata?.chunkIndex ?? 0,
        page: ch.metadata?.page,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Internal server error: ${msg}` }, 500);
  }
});

// ── POST /quiz/answer-update ──────────────────────────────────────────────────
// Codexa approach: client evaluated answer with local LLM, now tell backend
// the score to update the mastery doc. No LLM used on backend here.

quizRoutes.post("/answer-update", async (c) => {
  const user = c.var.user;
  try {
    const body = await c.req.json();
    const { concept, masteryBefore, score } = body;

    const newScore = calcNewMasteryScore(masteryBefore, score);

    await Mastery.updateOne(
      { userId: user.githubId, concept },
      {
        $set: { score: newScore, lastTested: new Date() },
        $inc: { attemptCount: 1, correctCount: score > 0.6 ? 1 : 0 },
      },
      { upsert: true }
    );

    return c.json({
      masteryAfter: newScore,
      delta: Number((newScore - masteryBefore).toFixed(4)),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Internal error: ${msg}` }, 500);
  }
});

// ── POST /quiz/answer ─────────────────────────────────────────────────────────

quizRoutes.post("/answer", async (c) => {
  const user = c.var.user;

  try {
    const bodyResult = QuizAnswerSchema.safeParse(await c.req.json());
    if (!bodyResult.success) {
      return c.json(
        { error: "Invalid request", details: bodyResult.error.flatten() },
        400
      );
    }

    const { questionId, answer } = bodyResult.data;

    // Look up the pending question from MongoDB
    const pending = await PendingQuestion.findOne({ questionId }).lean();

    if (!pending) {
      return c.json(
        { error: "Question not found or expired. Please request a new question." },
        404
      );
    }

    if (pending.userId !== user.githubId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    // Delete it immediately (single-use)
    await PendingQuestion.deleteOne({ questionId });

    // Deserialise chunks
    let chunks: RetrievedChunk[];
    try {
      chunks = JSON.parse(pending.chunksJson) as RetrievedChunk[];
    } catch {
      console.error("[quiz/answer] Failed to parse chunksJson for questionId:", questionId);
      return c.json({ error: "Corrupted question data. Please request a new question." }, 500);
    }

    // Evaluate answer via LLM
    const cfg = { ...user.providerConfig, userId: user.githubId };
    const llmReachable = await isProviderReachable(cfg);

    if (!llmReachable) {
      return c.json(
        {
          error: "LLM provider unavailable",
          message:
            `Answer evaluation requires an LLM. Your provider (${cfg.provider}) is not ` +
            `reachable from the server. Go to Settings → switch to OpenAI or Anthropic.`,
        },
        503
      );
    }

    const llm = getLLMProvider(cfg);
    const evalResult = await evaluateAnswer(
      pending.question,
      answer,
      chunks,
      llm
    );

    // Update mastery
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
  } catch (err) {
    if (err instanceof ProviderAuthError) {
      return c.json({ error: `Authentication failed: ${err.message}` }, 401);
    }
    if (err instanceof ProviderError) {
      return c.json({ error: `Provider error: ${err.message}` }, 503);
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[quiz/answer] Unhandled error:", msg);
    return c.json({ error: `Internal server error: ${msg}` }, 500);
  }
});
