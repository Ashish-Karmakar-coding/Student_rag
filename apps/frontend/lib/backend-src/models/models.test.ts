/**
 * apps/backend/src/models/models.test.ts
 *
 * Unit tests for pure helper functions in the model layer.
 * No MongoDB connection needed — these are pure functions.
 */

import { describe, it, expect } from "vitest";
import { calcNewMasteryScore } from "./Mastery";
import { calcJobProgress, deriveJobStatus } from "./IngestJob";
import type { IIngestFile } from "./IngestJob";

// ── calcNewMasteryScore ───────────────────────────────────────────────────────

describe("calcNewMasteryScore", () => {
  it("increases score when answer is correct (1.0)", () => {
    const result = calcNewMasteryScore(0.5, 1.0);
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThanOrEqual(0.99);
  });

  it("decreases score when answer is wrong (0.0)", () => {
    const result = calcNewMasteryScore(0.5, 0.0);
    expect(result).toBeLessThan(0.5);
    expect(result).toBeGreaterThanOrEqual(0.05);
  });

  it("is stable when correctness equals current score", () => {
    const result = calcNewMasteryScore(0.7, 0.7);
    expect(result).toBeCloseTo(0.7, 5);
  });

  it("clamps minimum to 0.05", () => {
    const result = calcNewMasteryScore(0.05, 0.0);
    expect(result).toBe(0.05);
  });

  it("clamps maximum to 0.99", () => {
    const result = calcNewMasteryScore(0.99, 1.0);
    expect(result).toBe(0.99);
  });

  it("applies 0.15 learning rate correctly", () => {
    // old=0.5, correctness=1.0 → 0.5 + 0.15*(1.0-0.5) = 0.5 + 0.075 = 0.575
    expect(calcNewMasteryScore(0.5, 1.0)).toBeCloseTo(0.575, 5);
  });
});

// ── calcJobProgress ───────────────────────────────────────────────────────────

const makeFile = (status: IIngestFile["status"]): IIngestFile => ({
  fileName: "test.pdf",
  sizeBytes: 1024,
  status,
  conceptsFound: [],
});

describe("calcJobProgress", () => {
  it("returns 0 for empty files array", () => {
    expect(calcJobProgress([])).toBe(0);
  });

  it("returns 0 when all files are queued", () => {
    expect(calcJobProgress([makeFile("queued"), makeFile("queued")])).toBe(0);
  });

  it("returns 50 when half the files are done", () => {
    expect(
      calcJobProgress([makeFile("done"), makeFile("queued")])
    ).toBe(50);
  });

  it("returns 100 when all files are done", () => {
    expect(calcJobProgress([makeFile("done"), makeFile("done")])).toBe(100);
  });

  it("counts errored files as complete for progress purposes", () => {
    expect(
      calcJobProgress([makeFile("error"), makeFile("done")])
    ).toBe(100);
  });
});

// ── deriveJobStatus ───────────────────────────────────────────────────────────

describe("deriveJobStatus", () => {
  it("returns 'queued' when all files are queued", () => {
    expect(deriveJobStatus([makeFile("queued")])).toBe("queued");
  });

  it("returns 'processing' when any file is processing", () => {
    expect(
      deriveJobStatus([makeFile("processing"), makeFile("queued")])
    ).toBe("processing");
  });

  it("returns 'done' when all files are done", () => {
    expect(deriveJobStatus([makeFile("done"), makeFile("done")])).toBe("done");
  });

  it("returns 'error' when all finished but some errored", () => {
    expect(
      deriveJobStatus([makeFile("done"), makeFile("error")])
    ).toBe("error");
  });
});
