import { createHash } from "crypto";
import { MAX_TAB_LEVEL, normalizePage } from "./localStore";
import type { DocumentPage } from "./types";

export const DOCUMENT_CONTENT_SCHEMA = "embar.document/v1";

export interface DocumentContent {
  schema: typeof DOCUMENT_CONTENT_SCHEMA;
  pages: DocumentPage[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parsePage(value: unknown): DocumentPage | null {
  const row = asRecord(value);
  if (!row || row.id == null) return null;
  return normalizePage({
    id: String(row.id),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    level: Number(row.level ?? 0),
  });
}

export function pagesToDocumentContent(pages: DocumentPage[]): DocumentContent {
  const normalized = (
    pages.length ? pages : [{ id: crypto.randomUUID(), title: "", body: "", level: 0 }]
  ).map((page) =>
    normalizePage({
      id: page.id,
      title: page.title ?? "",
      body: page.body ?? "",
      level: Math.min(MAX_TAB_LEVEL, Math.max(0, page.level ?? 0)),
    })
  );
  return { schema: DOCUMENT_CONTENT_SCHEMA, pages: normalized };
}

export function normalizeDocumentContent(input: unknown): DocumentContent {
  const row = asRecord(input);
  const rawPages = Array.isArray(row?.pages) ? row.pages : Array.isArray(input) ? input : [];
  const pages = rawPages.map(parsePage).filter((page): page is DocumentPage => page !== null);
  return pagesToDocumentContent(pages);
}

export function canonicalizeDocumentContent(input: unknown): string {
  const content = normalizeDocumentContent(input);
  return JSON.stringify({
    schema: content.schema,
    pages: content.pages.map((page) => ({
      id: page.id,
      title: page.title,
      body: page.body,
      level: page.level,
    })),
  });
}

export function hashDocumentContent(input: unknown): string {
  return createHash("sha256").update(canonicalizeDocumentContent(input), "utf8").digest("hex");
}
