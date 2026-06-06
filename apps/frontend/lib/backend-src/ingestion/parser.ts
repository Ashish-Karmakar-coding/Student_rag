/**
 * apps/backend/src/ingestion/parser.ts
 *
 * Converts uploaded file buffers to plain text strings.
 * Supports: PDF (.pdf), DOCX (.docx), Markdown (.md / .txt)
 *
 * All three parsers produce consistent plain text so the chunker
 * can treat every document identically regardless of source format.
 */

import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { marked } from "marked";
import path from "path";

// ── Result type ───────────────────────────────────────────────────────────────

export interface ParseResult {
  text: string;
  /** Total pages (PDF only — undefined for DOCX / MD) */
  pageCount?: number;
  /**
   * Maps character offset → page number.
   * Used downstream to attach page numbers to chunks.
   * PDF only.
   */
  pageMap: Array<{ startOffset: number; page: number }>;
}

// ── HTML stripper (for DOCX and MD output) ────────────────────────────────────

function stripHtml(html: string): string {
  // Replace block-level tags with newlines to preserve paragraph breaks
  return html
    .replace(/<\/?(p|div|h[1-6]|li|tr|br)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "") // strip remaining tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n") // collapse excessive blank lines
    .trim();
}

// ── PDF Parser ────────────────────────────────────────────────────────────────

async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  let pageMap: Array<{ startOffset: number; page: number }> = [];
  let currentOffset = 0;
  let pageCount = 0;

  const data = await pdfParse(buffer, {
    // Called once per page — lets us build a character-offset page map
    pagerender(pageData) {
      return pageData.getTextContent().then(
        (textContent: { items: Array<{ str: string }> }) => {
          const pageText = textContent.items.map((i) => i.str).join(" ");
          pageMap.push({ startOffset: currentOffset, page: pageData.pageNumber });
          currentOffset += pageText.length + 1; // +1 for newline separator
          pageCount = pageData.pageNumber;
          return pageText;
        }
      );
    },
  });

  return {
    text: data.text,
    pageCount,
    pageMap,
  };
}

// ── DOCX Parser ───────────────────────────────────────────────────────────────

async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  const result = await mammoth.convertToHtml({ buffer });

  if (result.messages.length > 0) {
    // Log any conversion warnings (e.g. unsupported formatting) — non-fatal
    result.messages.forEach((msg) => {
      if (msg.type === "warning") {
        console.warn("[parser:docx] Warning:", msg.message);
      }
    });
  }

  const text = stripHtml(result.value);
  return { text, pageMap: [] };
}

// ── Markdown Parser ───────────────────────────────────────────────────────────

async function parseMarkdown(buffer: Buffer): Promise<ParseResult> {
  const raw = buffer.toString("utf-8");
  // marked.parse returns HTML; strip it to plain text
  const html = await marked.parse(raw, { async: false });
  const text = stripHtml(html);
  return { text, pageMap: [] };
}

// ── Public dispatcher ─────────────────────────────────────────────────────────

/**
 * Parses a file buffer to plain text based on its extension.
 * @param buffer    Raw file bytes
 * @param fileName  Original filename (used to determine format)
 */
export async function parseFile(
  buffer: Buffer,
  fileName: string
): Promise<ParseResult> {
  const ext = path.extname(fileName).toLowerCase();

  switch (ext) {
    case ".pdf":
      return parsePdf(buffer);
    case ".docx":
      return parseDocx(buffer);
    case ".md":
    case ".txt":
    case ".markdown":
      return parseMarkdown(buffer);
    default:
      throw new Error(
        `Unsupported file type: ${ext}. Allowed: .pdf, .docx, .md`
      );
  }
}

/**
 * Given a character offset and a pageMap, returns the page number
 * for that position in the document. Falls back to 1 if no map exists.
 */
export function getPageForOffset(
  offset: number,
  pageMap: Array<{ startOffset: number; page: number }>
): number {
  if (pageMap.length === 0) return 1;
  let page = 1;
  for (const entry of pageMap) {
    if (offset >= entry.startOffset) {
      page = entry.page;
    } else {
      break;
    }
  }
  return page;
}
