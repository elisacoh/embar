"use server";

import { createClient } from "@/lib/supabase/server";
import type { EntityData } from "@/lib/types";

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
