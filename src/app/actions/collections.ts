"use server";

import { createClient } from "@/lib/supabase/server";
import type { Collection, DocumentCollectionLink } from "@/lib/documents/types";

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function mapCollection(row: Record<string, unknown>): Collection {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name ?? ""),
    parentCollectionId: (row.parent_collection_id as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function listCollections(
  workspaceId: string
): Promise<Collection[] | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  if (error) return { error: error.message };
  return (data ?? []).map((row) => mapCollection(row as Record<string, unknown>));
}

export async function createCollection(params: {
  workspaceId: string;
  name?: string;
  parentCollectionId?: string | null;
}): Promise<{ collection: Collection } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await supabase
    .from("collections")
    .insert({
      workspace_id: params.workspaceId,
      name: params.name ?? "",
      parent_collection_id: params.parentCollectionId ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { collection: mapCollection(data as Record<string, unknown>) };
}

export async function listDocumentCollections(
  documentId: string
): Promise<DocumentCollectionLink[] | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await supabase
    .from("document_collections")
    .select("document_id, collection_id")
    .eq("document_id", documentId);
  if (error) return { error: error.message };
  return (data ?? []).map((row) => ({
    documentId: String(row.document_id),
    collectionId: String(row.collection_id),
  }));
}

export async function addDocumentToCollection(
  documentId: string,
  collectionId: string
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase.from("document_collections").insert({
    document_id: documentId,
    collection_id: collectionId,
  });
  if (error) {
    if (error.code === "23505") return { ok: true };
    return { error: error.message };
  }
  return { ok: true };
}

export async function removeDocumentFromCollection(
  documentId: string,
  collectionId: string
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("document_collections")
    .delete()
    .eq("document_id", documentId)
    .eq("collection_id", collectionId);
  return error ? { error: error.message } : { ok: true };
}
