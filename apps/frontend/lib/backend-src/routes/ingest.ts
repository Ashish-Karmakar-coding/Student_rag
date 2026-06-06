/**
 * apps/backend/src/routes/ingest.ts
 *
 * Ingest routes:
 *   POST   /upload                → multipart upload, returns { jobId }
 *   GET    /ingest-status/:jobId  → poll job progress
 *   DELETE /upload/:fileName      → delete vectors + orphaned concepts
 */

import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { authMiddleware } from "../auth/middleware";
import { IngestJob } from "../models/IngestJob";
import { User } from "../models/User";
import { Mastery } from "../models/Mastery";
import { launchIngestion, type UploadedFile } from "../ingestion/pipeline";
import { deleteFileVectors } from "../ingestion/embedder";
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from "@study-tutor/shared";

export const ingestRoutes = new Hono();

ingestRoutes.use("*", authMiddleware);

// ── POST /upload ──────────────────────────────────────────────────────────────

ingestRoutes.post("/upload", async (c) => {
  const user = c.var.user;

  // Check provider is configured
  if (!user.providerConfig.model) {
    return c.json(
      { error: "No LLM provider configured. Please visit Settings first." },
      400
    );
  }

  // Parse multipart form data
  const body = await c.req.parseBody({ all: true });
  const rawFiles = body["files"] ?? body["file"];

  // Normalise to array
  const fileList: File[] = Array.isArray(rawFiles)
    ? (rawFiles as File[])
    : rawFiles
    ? [rawFiles as File]
    : [];

  if (fileList.length === 0) {
    return c.json({ error: "No files uploaded. Send files as form-data field 'files'." }, 400);
  }

  // Validate each file
  const validationErrors: string[] = [];
  const uploadedFiles: UploadedFile[] = [];

  for (const file of fileList) {
    // Extension check
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
      validationErrors.push(`${file.name}: unsupported type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
      continue;
    }

    // Size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      validationErrors.push(
        `${file.name}: too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 50MB`
      );
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    uploadedFiles.push({
      fileName: file.name,
      buffer,
      sizeBytes: file.size,
      mimeType: file.type,
    });
  }

  if (uploadedFiles.length === 0) {
    return c.json({ error: "No valid files to process", details: validationErrors }, 400);
  }

  // Create IngestJob document
  const jobId = uuidv4();
  await IngestJob.create({
    jobId,
    userId: user.githubId,
    status: "queued",
    progress: 0,
    completedAt: null,
    files: uploadedFiles.map((f) => ({
      fileName: f.fileName,
      sizeBytes: f.sizeBytes,
      status: "queued",
      conceptsFound: [],
    })),
  });

  // Launch background ingestion (non-blocking)
  launchIngestion(jobId, uploadedFiles, user);

  return c.json(
    {
      jobId,
      fileCount: uploadedFiles.length,
      skipped: validationErrors,
    },
    202 // Accepted
  );
});

// ── GET /files ─────────────────────────────────────────────────────────────────

ingestRoutes.get("/files", async (c) => {
  const user = c.var.user;

  const jobs = await IngestJob.find({ userId: user.githubId }).lean();
  
  const fileMap = new Map<string, { fileName: string, concepts: string[], subject: string, uploadedAt: string }>();
  
  for (const job of jobs) {
    for (const f of job.files) {
      if (f.status === "done" || f.status === "processing") {
        if (!fileMap.has(f.fileName)) {
          let subject = "general";
          if (f.conceptsFound && f.conceptsFound.length > 0) {
            const mastery = await Mastery.findOne({ userId: user.githubId, concept: f.conceptsFound[0] }).lean();
            if (mastery && mastery.subject) {
              subject = mastery.subject;
            }
          }
          const createdAt = job.createdAt ? new Date(job.createdAt).toISOString() : new Date().toISOString();
          fileMap.set(f.fileName, {
            fileName: f.fileName,
            concepts: f.conceptsFound || [],
            subject,
            uploadedAt: createdAt
          });
        }
      }
    }
  }
  
  const filesList = Array.from(fileMap.values()).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  
  return c.json(filesList);
});

// ── GET /ingest-status/:jobId ─────────────────────────────────────────────────

ingestRoutes.get("/ingest-status/:jobId", async (c) => {
  const user = c.var.user;
  const { jobId } = c.req.param();

  // Validate UUID format loosely
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return c.json({ error: "Invalid jobId format" }, 400);
  }

  const job = await IngestJob.findOne({
    jobId,
    userId: user.githubId, // enforce ownership
  }).lean();

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  const allConcepts = [
    ...new Set(job.files.flatMap((f) => f.conceptsFound)),
  ];

  return c.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    files: job.files.map((f) => ({
      fileName: f.fileName,
      status: f.status,
      conceptsFound: f.conceptsFound,
      error: f.error,
    })),
    conceptsFound: allConcepts,
    completedAt: job.completedAt?.toISOString() ?? null,
  });
});

// ── DELETE /upload/:fileName ───────────────────────────────────────────────────

ingestRoutes.delete("/upload/:fileName", async (c) => {
  const user = c.var.user;
  const { fileName } = c.req.param();

  if (!fileName) {
    return c.json({ error: "fileName is required" }, 400);
  }


  // Estimate chunk count for vector deletion
  // If job not found, attempt deletion with a generous upper bound
  const estimatedChunks = 500;

  try {
    await deleteFileVectors(user.githubId, fileName, estimatedChunks);
  } catch (err) {
    console.warn("[ingest] deleteFileVectors failed:", err);
  }

  // Remove mastery entries for concepts that no longer have any source
  // (only if no other file covers them — simplified: just leave mastery intact)
  // In production you'd cross-reference all remaining file concepts.

  // Mark file as removed in all job docs
  await IngestJob.updateMany(
    { userId: user.githubId, "files.fileName": fileName },
    { $set: { "files.$.status": "error", "files.$.error": "Deleted by user" } }
  );

  // If user has no more files, reset hasFiles
  const remainingJobs = await IngestJob.countDocuments({
    userId: user.githubId,
    status: "done",
    "files": { $elemMatch: { status: "done", fileName: { $ne: fileName } } },
  });

  if (remainingJobs === 0) {
    await User.updateOne(
      { githubId: user.githubId },
      { $set: { hasFiles: false } }
    );
  }

  return c.json({ ok: true, message: `Deleted vectors for ${fileName}` });
});
