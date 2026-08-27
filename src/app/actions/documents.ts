"use server";

import { createClient } from "@/lib/supabase/server";
import {
  hashDocumentContent,
  normalizeDocumentContent,
  pagesToDocumentContent,
} from "@/lib/documents/content";
import type { DocFolder, Document, DocumentPage } from "@/lib/documents/types";
import { type DocumentsLibraryData } from "@/lib/documents/localStore";

function workingStateFromPages(pages: DocumentPage[]) {
  const current_content = pagesToDocumentContent(pages);
  return {
    current_content,
    current_content_hash: hashDocumentContent(current_content),
    content: current_content.pages[0]?.body ?? "",
  };
}

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function mapFolder(row: Record<string, unknown>): DocFolder {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name ?? ""),
    parentId: (row.parent_id as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapLegacyPage(row: Record<string, unknown>): DocumentPage {
  return pagesToDocumentContent([
    {
      id: String(row.id),
      title: String(row.title ?? ""),
      body: String(row.body ?? ""),
      level: Number(row.level ?? 0),
    },
  ]).pages[0]!;
}

function mapDocument(row: Record<string, unknown>, fallbackPages: DocumentPage[]): Document {
  const fromJson = row.current_content ? normalizeDocumentContent(row.current_content).pages : [];
  const pages = fromJson.length ? fromJson : fallbackPages;
  const first = pages[0];
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title ?? ""),
    body: first?.body ?? String(row.content ?? ""),
    pages: pages.length ? pages : [{ id: crypto.randomUUID(), title: "", body: "", level: 0 }],
    folderId: (row.folder_id as string | null) ?? null,
    documentTypeId: (row.document_type_id as string | null) ?? null,
    currentContentHash: (row.current_content_hash as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function listDocumentLibrary(
  workspaceId: string
): Promise<DocumentsLibraryData | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };

  const [foldersRes, docsRes, pagesRes] = await Promise.all([
    supabase
      .from("document_folders")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("documents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("type", "native")
      .is("deleted_at", null)
      .is("archived_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("document_pages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("position", { ascending: true }),
  ]);

  if (foldersRes.error) return { error: foldersRes.error.message };
  if (docsRes.error) return { error: docsRes.error.message };
  if (pagesRes.error) return { error: pagesRes.error.message };

  const pagesByDoc = new Map<string, DocumentPage[]>();
  for (const row of pagesRes.data ?? []) {
    const page = mapLegacyPage(row as Record<string, unknown>);
    const docId = String((row as { document_id: string }).document_id);
    const list = pagesByDoc.get(docId) ?? [];
    list.push(page);
    pagesByDoc.set(docId, list);
  }

  return {
    folders: (foldersRes.data ?? []).map((row) => mapFolder(row as Record<string, unknown>)),
    documents: (docsRes.data ?? []).map((row) =>
      mapDocument(row as Record<string, unknown>, pagesByDoc.get(String(row.id)) ?? [])
    ),
  };
}

export async function createDocumentRecord(params: {
  id: string;
  workspaceId: string;
  folderId: string | null;
  title?: string;
  pages: DocumentPage[];
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };

  const working = workingStateFromPages(params.pages);
  const { error: docError } = await supabase.from("documents").insert({
    id: params.id,
    workspace_id: params.workspaceId,
    folder_id: params.folderId,
    title: params.title ?? "",
    type: "native",
    document_type_id: null,
    content: working.content,
    current_content: working.current_content,
    current_content_hash: working.current_content_hash,
    archived_at: null,
    created_by: user.id,
  });
  if (docError) return { error: docError.message };
  return { ok: true };
}

export async function updateDocumentRecord(
  id: string,
  patch: { title?: string; folderId?: string | null; body?: string }
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.folderId !== undefined) payload.folder_id = patch.folderId;
  if (patch.body !== undefined) payload.content = patch.body;

  const { error } = await supabase.from("documents").update(payload).eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteDocumentRecord(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("documents")
    .update({ archived_at: now, deleted_at: now })
    .eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function saveDocumentWorkingState(params: {
  id: string;
  title?: string;
  pages: DocumentPage[];
}): Promise<{ ok: true; hash: string } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };

  const working = workingStateFromPages(params.pages);
  const { data: existing, error: existingError } = await supabase
    .from("documents")
    .select("current_content_hash, title")
    .eq("id", params.id)
    .maybeSingle();
  if (existingError) return { error: existingError.message };

  const sameContent = existing?.current_content_hash === working.current_content_hash;
  const sameTitle = params.title === undefined || params.title === existing?.title;
  if (sameContent && sameTitle) {
    return { ok: true, hash: working.current_content_hash };
  }

  const payload: Record<string, unknown> = {
    current_content: working.current_content,
    current_content_hash: working.current_content_hash,
    content: working.content,
    updated_at: new Date().toISOString(),
  };
  if (params.title !== undefined) payload.title = params.title;

  const { error } = await supabase.from("documents").update(payload).eq("id", params.id);
  return error ? { error: error.message } : { ok: true, hash: working.current_content_hash };
}

export async function saveDocumentPages(
  _workspaceId: string,
  documentId: string,
  pages: DocumentPage[]
): Promise<{ ok: true } | { error: string }> {
  const result = await saveDocumentWorkingState({ id: documentId, pages });
  return "error" in result ? result : { ok: true };
}

export async function createFolderRecord(params: {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name?: string;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase.from("document_folders").insert({
    id: params.id,
    workspace_id: params.workspaceId,
    parent_id: params.parentId,
    name: params.name ?? "",
    created_by: user.id,
  });
  return error ? { error: error.message } : { ok: true };
}

export async function renameFolderRecord(
  id: string,
  name: string
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("document_folders")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteFolderRecord(params: {
  id: string;
  parentId: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const now = new Date().toISOString();

  const movedDocs = await supabase
    .from("documents")
    .update({ folder_id: params.parentId, updated_at: now })
    .eq("folder_id", params.id)
    .is("deleted_at", null);
  if (movedDocs.error) return { error: movedDocs.error.message };

  const movedFolders = await supabase
    .from("document_folders")
    .update({ parent_id: params.parentId, updated_at: now })
    .eq("parent_id", params.id)
    .is("deleted_at", null);
  if (movedFolders.error) return { error: movedFolders.error.message };

  const { error } = await supabase
    .from("document_folders")
    .update({ deleted_at: now })
    .eq("id", params.id);
  return error ? { error: error.message } : { ok: true };
}

export async function importLocalDocumentLibrary(
  workspaceId: string,
  library: DocumentsLibraryData
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };

  const sortedFolders: DocFolder[] = [];
  const remaining = [...library.folders];
  while (remaining.length) {
    const readyIndex = remaining.findIndex(
      (folder) => !folder.parentId || sortedFolders.some((item) => item.id === folder.parentId)
    );
    if (readyIndex === -1) {
      sortedFolders.push(...remaining);
      break;
    }
    sortedFolders.push(remaining.splice(readyIndex, 1)[0]!);
  }

  for (const folder of sortedFolders) {
    const { error } = await supabase.from("document_folders").upsert({
      id: folder.id,
      workspace_id: workspaceId,
      parent_id: folder.parentId,
      name: folder.name,
      created_at: folder.createdAt,
      created_by: user.id,
      deleted_at: null,
    });
    if (error) return { error: error.message };
  }

  for (const doc of library.documents) {
    const working = workingStateFromPages(doc.pages);
    const { error } = await supabase.from("documents").upsert({
      id: doc.id,
      workspace_id: workspaceId,
      folder_id: doc.folderId,
      title: doc.title,
      type: "native",
      document_type_id: null,
      content: working.content,
      current_content: working.current_content,
      current_content_hash: working.current_content_hash,
      created_at: doc.createdAt,
      updated_at: doc.updatedAt,
      created_by: user.id,
      deleted_at: null,
      archived_at: null,
    });
    if (error) return { error: error.message };
  }

  return { ok: true };
}
