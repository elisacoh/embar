"use server";

import { createClient } from "@/lib/supabase/server";
import { serializeFieldValue, type DocumentFieldType } from "@/lib/documents/fields";
import type { DocumentFieldValue, DocumentType, FieldDefinition } from "@/lib/documents/types";

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mapType(row: Record<string, unknown>): DocumentType {
  return {
    id: String(row.id),
    workspaceId: (row.workspace_id as string | null) ?? null,
    systemKey: (row.system_key as string | null) ?? null,
    name: String(row.name ?? ""),
    description: (row.description as string | null) ?? null,
    isSystem: Boolean(row.is_system),
  };
}

function mapField(row: Record<string, unknown>): FieldDefinition {
  return {
    id: String(row.id),
    documentTypeId: String(row.document_type_id),
    key: String(row.key),
    label: String(row.label ?? row.key),
    fieldType: (row.field_type as DocumentFieldType) ?? "text",
    config: asRecord(row.config),
    visibleByDefault: row.visible_by_default !== false,
    searchWeight: Number(row.search_weight ?? 0),
    position: Number(row.position ?? 0),
  };
}

function mapValue(row: Record<string, unknown>): DocumentFieldValue {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    fieldDefinitionId: (row.field_definition_id as string | null) ?? null,
    localFieldKey: (row.local_field_key as string | null) ?? null,
    value: row.value ?? null,
  };
}

export async function listDocumentTypes(
  workspaceId: string
): Promise<DocumentType[] | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("document_types")
    .select("*")
    .or(`is_system.eq.true,workspace_id.eq.${workspaceId}`)
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });
  if (error) return { error: error.message };
  return (data ?? []).map((row) => mapType(row as Record<string, unknown>));
}

export async function listFieldDefinitions(
  documentTypeId: string | null
): Promise<FieldDefinition[] | { error: string }> {
  if (!documentTypeId) return [];
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await supabase
    .from("field_definitions")
    .select("*")
    .eq("document_type_id", documentTypeId)
    .order("position", { ascending: true });
  if (error) return { error: error.message };
  return (data ?? []).map((row) => mapField(row as Record<string, unknown>));
}

export async function listDocumentFieldValues(
  documentId: string
): Promise<DocumentFieldValue[] | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await supabase
    .from("document_field_values")
    .select("*")
    .eq("document_id", documentId);
  if (error) return { error: error.message };
  return (data ?? []).map((row) => mapValue(row as Record<string, unknown>));
}

export async function setDocumentType(
  documentId: string,
  documentTypeId: string | null
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("documents")
    .update({ document_type_id: documentTypeId, updated_at: new Date().toISOString() })
    .eq("id", documentId);
  return error ? { error: error.message } : { ok: true };
}

async function loadDocumentWorkspace(documentId: string) {
  const { supabase, user } = await authed();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, workspace_id")
    .eq("id", documentId)
    .maybeSingle();
  if (docError) return { ok: false as const, error: docError.message };
  if (!doc) return { ok: false as const, error: "Document not found" };
  return { ok: true as const, supabase, doc };
}

export async function upsertDocumentFieldValue(params: {
  documentId: string;
  fieldDefinitionId: string;
  fieldType: DocumentFieldType;
  value: unknown;
}): Promise<{ ok: true } | { error: string }> {
  const loaded = await loadDocumentWorkspace(params.documentId);
  if (!loaded.ok) return { error: loaded.error };

  const stored = serializeFieldValue(params.fieldType, params.value);
  const now = new Date().toISOString();
  const { error } = await loaded.supabase.from("document_field_values").upsert(
    {
      workspace_id: loaded.doc.workspace_id,
      document_id: params.documentId,
      field_definition_id: params.fieldDefinitionId,
      local_field_key: null,
      value: stored,
      updated_at: now,
    },
    { onConflict: "document_id,field_definition_id" }
  );
  return error ? { error: error.message } : { ok: true };
}

export async function upsertLocalDocumentFieldValue(params: {
  documentId: string;
  localFieldKey: string;
  value: unknown;
}): Promise<{ ok: true } | { error: string }> {
  const key = params.localFieldKey.trim();
  if (!key) return { error: "Local field key is required" };
  const loaded = await loadDocumentWorkspace(params.documentId);
  if (!loaded.ok) return { error: loaded.error };

  const stored = serializeFieldValue("text", params.value);
  const now = new Date().toISOString();
  const { error } = await loaded.supabase.from("document_field_values").upsert(
    {
      workspace_id: loaded.doc.workspace_id,
      document_id: params.documentId,
      field_definition_id: null,
      local_field_key: key,
      value: stored,
      updated_at: now,
    },
    { onConflict: "document_id,local_field_key" }
  );
  return error ? { error: error.message } : { ok: true };
}
