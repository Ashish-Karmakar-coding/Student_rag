/**
 * apps/backend/src/ingestion/pipeline.ts
 *
 * Top-level ingestion orchestrator.
 *
 * Called from POST /upload after the IngestJob doc has been created.
 * Runs asynchronously (via setImmediate) so the HTTP response is immediate.
 *
 * For each file:
 *   parse → chunk → tag concepts → embed + upsert → seed mastery
 *
 * Updates IngestJob progress in MongoDB after each file.
 * On completion, marks User.hasFiles = true.
 *
 * All failures are caught per-file — one bad file doesn't abort the job.
 */

import { parseFile } from "./parser.js";
import { chunkDocument } from "./chunker.js";
import { tagChunks, inferSubject, collectUniqueConcepts } from "./conceptTagger.js";
import { embedAndUpsert } from "./embedder.js";
import { IngestJob, calcJobProgress, deriveJobStatus } from "../models/IngestJob.js";
import { Mastery } from "../models/Mastery.js";
import { User } from "../models/User.js";
import { getLLMProvider, getEmbeddingProvider, isProviderReachable } from "../providers/factory.js";
import type { IUser } from "../models/User.js";
import type { TaggedChunk } from "./conceptTagger.js";
import type { Chunk } from "./chunker.js";


/** Fallback when LLM is unavailable — assigns ["general"] to every chunk. */
function fallbackTagChunks(chunks: Chunk[]): TaggedChunk[] {
  return chunks.map((chunk) => ({ ...chunk, conceptTags: ["general"] }));
}

// ── Uploaded file shape (from Hono multipart parser) ─────────────────────────

export interface UploadedFile {
  fileName: string;
  buffer: Buffer;
  sizeBytes: number;
  mimeType: string;
}

// ── Per-file pipeline ─────────────────────────────────────────────────────────

async function processFile(
  file: UploadedFile,
  user: IUser,
  jobId: string,
  _fileIndex: number
): Promise<{ conceptsFound: string[]; subject: string }> {
  const { fileName, buffer } = file;

  console.log(`[pipeline] Processing file: ${fileName}`);

  // ── Mark file as processing ───────────────────────────────────────────────
  await IngestJob.updateOne(
    { jobId, "files.fileName": fileName },
    { $set: { "files.$.status": "processing" } }
  );

  // ── 1. Parse ───────────────────────────────────────────────────────────────
  const parseResult = await parseFile(buffer, fileName);

  if (!parseResult.text.trim()) {
    throw new Error("Document appears to be empty or unreadable");
  }

  console.log(
    `[pipeline] ${fileName}: parsed ${parseResult.text.length} chars, ` +
    `${parseResult.pageCount ?? "N/A"} pages`
  );

  // ── 2. Chunk ───────────────────────────────────────────────────────────────
  const chunks = await chunkDocument(parseResult);
  console.log(`[pipeline] ${fileName}: ${chunks.length} chunks`);

  if (chunks.length === 0) {
    throw new Error("No content chunks produced — file may be image-only PDF");
  }

  // ── 3. Tag concepts ────────────────────────────────────────────────────────
  const providerCfg = {
    ...user.providerConfig,
    userId: user.githubId,
  };

  const llmAvailable = await isProviderReachable(providerCfg);

  let taggedChunks;
  if (llmAvailable) {
    const llm = getLLMProvider(providerCfg);
    taggedChunks = await tagChunks(chunks, llm);
  } else {
    console.warn(
      `[pipeline] ${fileName}: LLM (${providerCfg.provider}) not reachable — using fallback tags. ` +
      `Configure OpenAI or Anthropic in Settings for better concept extraction.`
    );
    taggedChunks = fallbackTagChunks(chunks);
  }

  const subject = inferSubject(taggedChunks);
  const uniqueConcepts = collectUniqueConcepts(taggedChunks);

  console.log(
    `[pipeline] ${fileName}: subject="${subject}", ` +
    `${uniqueConcepts.length} unique concepts`
  );

  // ── 4. Embed + upsert to Pinecone ──────────────────────────────────────────
  const embedder = getEmbeddingProvider(providerCfg);

  const { vectorCount, failedChunks } = await embedAndUpsert(
    taggedChunks,
    user.githubId,
    fileName,
    subject,
    embedder
  );

  console.log(
    `[pipeline] ${fileName}: ${vectorCount} vectors upserted, ` +
    `${failedChunks} failed`
  );

  // ── 5. Seed mastery entries for new concepts ───────────────────────────────
  const masteryOps = uniqueConcepts.map((concept) =>
    Mastery.updateOne(
      { userId: user.githubId, concept },
      {
        $setOnInsert: {
          score: 0.5,
          subject,
          attemptCount: 0,
          correctCount: 0,
          lastTested: null,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    )
  );

  await Promise.all(masteryOps);
  console.log(
    `[pipeline] ${fileName}: seeded/verified ${uniqueConcepts.length} mastery entries`
  );

  return { conceptsFound: uniqueConcepts, subject };
}

// ── Main pipeline runner ──────────────────────────────────────────────────────

/**
 * Runs the full ingestion pipeline for all files in a job.
 * Called via setImmediate — does NOT block the HTTP response.
 *
 * @param jobId   The IngestJob document ID
 * @param files   Array of uploaded files
 * @param user    The authenticated user (from MongoDB)
 */
export async function runIngestion(
  jobId: string,
  files: UploadedFile[],
  user: IUser
): Promise<void> {
  console.log(
    `[pipeline] Starting job ${jobId} — ${files.length} file(s)`
  );

  // Mark job as processing
  await IngestJob.updateOne({ jobId }, { $set: { status: "processing" } });

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;

    try {
      const { conceptsFound } = await processFile(file, user, jobId, i);

      // Mark file as done
      await IngestJob.updateOne(
        { jobId, "files.fileName": file.fileName },
        {
          $set: {
            "files.$.status": "done",
            "files.$.conceptsFound": conceptsFound,
          },
        }
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[pipeline] File "${file.fileName}" failed:`,
        errMsg
      );

      // Mark file as error — continue processing remaining files
      await IngestJob.updateOne(
        { jobId, "files.fileName": file.fileName },
        {
          $set: {
            "files.$.status": "error",
            "files.$.error": errMsg,
          },
        }
      );
    }

    // Update overall job progress after each file
    const job = await IngestJob.findOne({ jobId });
    if (job) {
      const progress = calcJobProgress(job.files);
      const status = deriveJobStatus(job.files);
      await IngestJob.updateOne({ jobId }, { $set: { progress, status } });
    }
  }

  // ── Finalize job ────────────────────────────────────────────────────────────
  const finalJob = await IngestJob.findOne({ jobId });
  if (finalJob) {
    const finalStatus = deriveJobStatus(finalJob.files);
    await IngestJob.updateOne(
      { jobId },
      {
        $set: {
          status: finalStatus,
          progress: 100,
          completedAt: new Date(),
        },
      }
    );
  }

  // Mark user as having files (only set, never unset)
  await User.updateOne(
    { githubId: user.githubId },
    { $set: { hasFiles: true } }
  );

  console.log(`[pipeline] Job ${jobId} complete — status: ${finalJob ? deriveJobStatus(finalJob.files) : "unknown"}`);
}

// ── Safe background launcher ──────────────────────────────────────────────────

/**
 * Launches runIngestion in the background via setImmediate.
 * Errors are caught and logged — they cannot propagate to the HTTP handler.
 */
export function launchIngestion(
  jobId: string,
  files: UploadedFile[],
  user: IUser
): void {
  setImmediate(() => {
    runIngestion(jobId, files, user).catch((err) => {
      console.error(`[pipeline] Job ${jobId} unhandled error:`, err);
      // Mark job as errored in MongoDB so the frontend knows
      IngestJob.updateOne(
        { jobId },
        { $set: { status: "error", completedAt: new Date() } }
      ).catch(console.error);
    });
  });
}
