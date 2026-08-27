import type { DocFolder, Document, DocumentPage } from "./types";

function storageKey(workspaceId: string): string {
  return `embar-docs:${workspaceId}`;
}

export const MAX_TAB_LEVEL = 2;

export interface DocumentsLibraryData {
  documents: Document[];
  folders: DocFolder[];
}

export function createBlankPage(level = 0): DocumentPage {
  return { id: crypto.randomUUID(), title: "", body: "", level: Math.min(MAX_TAB_LEVEL, level) };
}

export function normalizePage(page: DocumentPage): DocumentPage {
  return { ...page, level: Math.min(MAX_TAB_LEVEL, Math.max(0, page.level ?? 0)) };
}

export function normalizeDocument(doc: Document): Document {
  const pages = doc.pages?.length
    ? doc.pages.map(normalizePage)
    : [
        {
          id: crypto.randomUUID(),
          title: doc.title ?? "",
          body: doc.body ?? "",
          level: 0,
        },
      ];
  return {
    ...doc,
    pages,
    folderId: doc.folderId ?? null,
    documentTypeId: doc.documentTypeId ?? null,
    currentContentHash: doc.currentContentHash ?? null,
  };
}

function emptyLibrary(): DocumentsLibraryData {
  return { documents: [], folders: [] };
}

export function loadLibrary(workspaceId: string): DocumentsLibraryData {
  if (typeof window === "undefined" || !workspaceId) return emptyLibrary();
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (!raw) return emptyLibrary();
    const parsed = JSON.parse(raw) as DocumentsLibraryData | Document[];
    if (Array.isArray(parsed)) {
      return { documents: parsed.map(normalizeDocument), folders: [] };
    }
    return {
      documents: Array.isArray(parsed.documents) ? parsed.documents.map(normalizeDocument) : [],
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    };
  } catch {
    return emptyLibrary();
  }
}

export function loadDocuments(workspaceId: string): Document[] {
  return loadLibrary(workspaceId).documents;
}

export function persistLibrary(workspaceId: string, library: DocumentsLibraryData): void {
  if (typeof window === "undefined" || !workspaceId) return;
  localStorage.setItem(storageKey(workspaceId), JSON.stringify(library));
}

export function persistDocuments(workspaceId: string, documents: Document[]): void {
  const current = loadLibrary(workspaceId);
  persistLibrary(workspaceId, { ...current, documents });
}

export function clearLibrary(workspaceId: string): void {
  if (typeof window === "undefined" || !workspaceId) return;
  localStorage.removeItem(storageKey(workspaceId));
}

export function hasLocalLibrary(workspaceId: string): boolean {
  if (typeof window === "undefined" || !workspaceId) return false;
  const raw = localStorage.getItem(storageKey(workspaceId));
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as DocumentsLibraryData | Document[];
    if (Array.isArray(parsed)) return parsed.length > 0;
    return (parsed.documents?.length ?? 0) > 0 || (parsed.folders?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export function createBlankDocument(workspaceId: string, folderId: string | null = null): Document {
  const now = new Date().toISOString();
  const page = createBlankPage();
  return {
    id: crypto.randomUUID(),
    workspaceId,
    title: "",
    body: "",
    pages: [page],
    folderId,
    documentTypeId: null,
    currentContentHash: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankFolder(workspaceId: string, parentId: string | null = null): DocFolder {
  return {
    id: crypto.randomUUID(),
    workspaceId,
    name: "",
    parentId,
    createdAt: new Date().toISOString(),
  };
}

export function upsertDocument(documents: Document[], next: Document): Document[] {
  const exists = documents.some((doc) => doc.id === next.id);
  const updated = exists
    ? documents.map((doc) => (doc.id === next.id ? next : doc))
    : [next, ...documents];
  return updated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
