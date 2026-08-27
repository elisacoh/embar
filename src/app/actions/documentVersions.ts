"use server";

import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { hashDocumentContent, normalizeDocumentContent } from "@/lib/documents/content";
import {
  nextVersionNumber,
  shouldCreateNewVersion,
  type DocumentAssetType,
  type DocumentVersionSource,
} from "@/lib/documents/versions";
import type { DocumentAsset, DocumentVersion } from "@/lib/documents/types";

const ASSET_BUCKET = "document-assets";
const MAX_ASSET_BYTES = 25 * 1024 * 1024;

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function mapVersion(row: Record<string, unknown>): DocumentVersion {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    parentVersionId: (row.parent_version_id as string | null) ?? null,
    versionNumber: Number(row.version_number),
    contentHash: String(row.content_hash ?? ""),
    label: (row.label as string | null) ?? null,
    highlighted: Boolean(row.highlighted),
    source: (row.source as DocumentVersionSource) ?? "manual",
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapAsset(row: Record<string, unknown>): DocumentAsset {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    documentVersionId: (row.document_version_id as string | null) ?? null,
    assetType: (row.asset_type as DocumentAssetType) ?? "attachment",
    filename: String(row.filename ?? "file"),
    mimeType: String(row.mime_type ?? "application/octet-stream"),
    storageKey: String(row.storage_key),
    contentHash: (row.content_hash as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function assetTypeFor(mime: string, filename: string): DocumentAssetType {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) return "uploaded_pdf";
  if (filename.toLowerCase().endsWith(".docx")) return "original_docx";
  return "attachment";
}

function safeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || "file").slice(0, 120);
}

export async function listDocumentVersions(
  documentId: string
): Promise<DocumentVersion[] | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await supabase
    .from("document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false });
  if (error) return { error: error.message };
  return (data ?? []).map((row) => mapVersion(row as Record<string, unknown>));
}

export async function saveDocumentVersion(params: {
  documentId: string;
  label?: string | null;
}): Promise<{ ok: true; alreadySaved: boolean; version: DocumentVersion } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, workspace_id, current_content, current_content_hash")
    .eq("id", params.documentId)
    .maybeSingle();
  if (docError) return { error: docError.message };
  if (!doc) return { error: "Document not found" };

  const content = normalizeDocumentContent(doc.current_content);
  const contentHash = String(doc.current_content_hash || hashDocumentContent(content));

  const { data: latest, error: latestError } = await supabase
    .from("document_versions")
    .select("*")
    .eq("document_id", params.documentId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) return { error: latestError.message };

  if (latest && !shouldCreateNewVersion(contentHash, String(latest.content_hash))) {
    return {
      ok: true,
      alreadySaved: true,
      version: mapVersion(latest as Record<string, unknown>),
    };
  }

  const versionNumber = nextVersionNumber(latest?.version_number as number | null);
  const label = params.label?.trim() || null;
  const { data: inserted, error: insertError } = await supabase
    .from("document_versions")
    .insert({
      workspace_id: doc.workspace_id,
      document_id: params.documentId,
      parent_version_id: latest?.id ?? null,
      version_number: versionNumber,
      content,
      content_hash: contentHash,
      label,
      highlighted: false,
      source: "manual",
      created_by: user.id,
    })
    .select("*")
    .single();
  if (insertError) return { error: insertError.message };

  return {
    ok: true,
    alreadySaved: false,
    version: mapVersion(inserted as Record<string, unknown>),
  };
}

export async function setDocumentVersionHighlighted(
  id: string,
  highlighted: boolean
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase.from("document_versions").update({ highlighted }).eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function listDocumentAssets(
  documentId: string
): Promise<DocumentAsset[] | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await supabase
    .from("document_assets")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return (data ?? []).map((row) => mapAsset(row as Record<string, unknown>));
}

export async function attachDocumentAsset(
  formData: FormData
): Promise<{ ok: true; asset: DocumentAsset } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };

  const documentId = String(formData.get("documentId") ?? "");
  const versionIdRaw = String(formData.get("documentVersionId") ?? "");
  const file = formData.get("file");
  if (!documentId || !(file instanceof File) || file.size === 0) {
    return { error: "Missing file" };
  }
  if (file.size > MAX_ASSET_BYTES) return { error: "File is larger than 25 MB" };

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, workspace_id")
    .eq("id", documentId)
    .maybeSingle();
  if (docError) return { error: docError.message };
  if (!doc) return { error: "Document not found" };

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const assetId = crypto.randomUUID();
  const filename = safeFilename(file.name);
  const storageKey = `${doc.workspace_id}/${documentId}/${assetId}/${filename}`;
  const mimeType = file.type || "application/octet-stream";

  const uploaded = await supabase.storage.from(ASSET_BUCKET).upload(storageKey, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploaded.error) return { error: uploaded.error.message };

  const { data: inserted, error: insertError } = await supabase
    .from("document_assets")
    .insert({
      id: assetId,
      workspace_id: doc.workspace_id,
      document_id: documentId,
      document_version_id: versionIdRaw || null,
      asset_type: assetTypeFor(mimeType, file.name),
      filename: file.name || filename,
      mime_type: mimeType,
      storage_key: storageKey,
      content_hash: contentHash,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (insertError) {
    await supabase.storage.from(ASSET_BUCKET).remove([storageKey]);
    return { error: insertError.message };
  }

  return { ok: true, asset: mapAsset(inserted as Record<string, unknown>) };
}

export async function createDocumentAssetUrl(
  id: string
): Promise<{ url: string } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { data: asset, error } = await supabase
    .from("document_assets")
    .select("storage_key")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!asset?.storage_key) return { error: "File not found" };
  const signed = await supabase.storage.from(ASSET_BUCKET).createSignedUrl(asset.storage_key, 60);
  if (signed.error || !signed.data?.signedUrl) {
    return { error: signed.error?.message ?? "Could not create download link" };
  }
  return { url: signed.data.signedUrl };
}
