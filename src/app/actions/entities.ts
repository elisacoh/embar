"use server";

import { createClient } from "@/lib/supabase/server";
import type { EntityData } from "@/lib/types";

async function authedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function renameEntity(
  id: string,
  name: string
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authedClient();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase.from("entities").update({ name }).eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function recolorEntity(
  id: string,
  color: string
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authedClient();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase.from("entities").update({ color }).eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function archiveEntity(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authedClient();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("entities")
    .update({ deleted_at: new Date().toISOString(), metadata: { archived: true } })
    .eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteEntity(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authedClient();
  if (!user) return { error: "Not authenticated" };
  // Soft-delete entity; cascade soft-deletes items via DB trigger would be Sprint 3.
  // For now delete_at on entity is sufficient — items are filtered by entity.
  const { error } = await supabase
    .from("entities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function reorderEntities(
  orderedIds: string[]
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await authedClient();
  if (!user) return { error: "Not authenticated" };
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      supabase
        .from("entities")
        .update({ position: (i + 1) * 1000 })
        .eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  return failed?.error ? { error: failed.error.message } : { ok: true };
}

export async function createEntity(params: {
  workspaceId: string;
  name: string;
  type: string; // 'client' | 'project' | 'subject' — stored in metadata
  color: string;
}): Promise<{ entity: EntityData } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Determine next position — steps of 1000 to leave room for drag reordering
  const { data: last } = await supabase
    .from("entities")
    .select("position")
    .eq("workspace_id", params.workspaceId) // always scope to workspace
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = ((last?.[0]?.position as number) ?? 0) + 1000;

  const { data: entity, error } = await supabase
    .from("entities")
    .insert({
      workspace_id: params.workspaceId,
      name: params.name,
      color: params.color,
      mode: "flow", // default kanban mode — user can switch in Sprint 6
      position: nextPosition,
      created_by: user.id,
      metadata: { type: params.type },
    })
    .select("id, name, color, position, mode")
    .single();

  if (error || !entity) {
    return { error: error?.message ?? "Failed to create entity" };
  }

  return { entity: entity as EntityData };
}
