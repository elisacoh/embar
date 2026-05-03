"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeItem } from "@/lib/normalize";
import type { ItemData, Subtask } from "@/lib/types";

const ITEM_SELECT = "*";

export async function createItem(params: {
  workspaceId: string;
  title: string;
  description?: string | null;
  subtasks?: Subtask[];
  entityId?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  durationEstimate?: number | null;
  isFixed?: boolean;
  waitingFor?: string | null;
  location?: string | null;
  // expanded fields
  state?: string;
  urgency?: string;
  workType?: string | null;
  dueDate?: string | null;
  hardDeadline?: boolean;
}): Promise<{ item: ItemData } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: raw, error } = await supabase
    .from("items")
    .insert({
      workspace_id: params.workspaceId,
      title: params.title.trim(),
      description: params.description ?? null,
      subtasks: params.subtasks ?? [],
      entity_id: params.entityId ?? null,
      scheduled_date: params.scheduledDate ?? null,
      scheduled_time: params.scheduledTime ?? null,
      duration_estimate: params.durationEstimate ?? null,
      is_fixed: params.isFixed ?? false,
      waiting_for: params.waitingFor ?? null,
      metadata: params.location ? { location: params.location } : null,
      state: params.state ?? "unplanned",
      urgency: params.urgency ?? "normal",
      work_type: params.workType ?? null,
      due_date: params.dueDate ?? null,
      hard_deadline: params.hardDeadline ?? false,
      assigned_to: user.id,
      created_by: user.id,
    })
    .select(ITEM_SELECT)
    .single();

  if (error || !raw) return { error: error?.message ?? "Failed to create task" };
  return { item: normalizeItem(raw as Record<string, unknown>) };
}

export async function getItem(id: string): Promise<{ item: ItemData } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: raw, error } = await supabase
    .from("items")
    .select(ITEM_SELECT)
    .eq("id", id)
    .single();

  if (error || !raw) return { error: error?.message ?? "Not found" };
  return { item: normalizeItem(raw as Record<string, unknown>) };
}

export async function deleteItem(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function updateItem(
  id: string,
  updates: Partial<{
    title: string;
    description: string | null;
    state: string;
    urgency: string;
    work_type: string | null;
    entity_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    duration_estimate: number | null;
    duration_actual: number | null;
    completed_at: string | null;
    due_date: string | null;
    hard_deadline: boolean;
    is_fixed: boolean;
    waiting_for: string | null;
    subtasks: Subtask[];
    metadata: Record<string, unknown> | null;
    time_spent_ms: number;
    position: number;
  }>
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("items").update(updates).eq("id", id);
  return error ? { error: error.message } : { ok: true };
}
