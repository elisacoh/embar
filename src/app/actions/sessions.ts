"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeItem, normalizeSession } from "@/lib/normalize";
import type { SessionData, SessionColumn, ItemData } from "@/lib/types";

export type { SessionColumn };

const SESSION_SELECT =
  "id, workspace_id, entity_id, title, type, scheduled_date, scheduled_time, duration_estimate, duration_actual, status, completed_units, total_units, metadata, ai_summary, created_at, deleted_at";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function createSessionFull(params: {
  workspaceId: string;
  title: string;
  scheduledDate?: string;
  lightTasks: Array<{
    title: string;
    durationEstimate?: number | null;
    scheduledTime?: string | null;
  }>;
  realTaskIds: string[];
  columns?: SessionColumn[];
}): Promise<{ session: SessionData } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const date = params.scheduledDate ?? todayStr();
  const totalUnits = params.lightTasks.length + params.realTaskIds.length;

  const metadata = params.columns && params.columns.length > 0 ? { columns: params.columns } : null;

  const { data: raw, error: sessionErr } = await supabase
    .from("sessions")
    .insert({
      workspace_id: params.workspaceId,
      title: params.title.trim(),
      scheduled_date: date,
      type: "focus_session",
      status: "pending",
      completed_units: 0,
      total_units: totalUnits || null,
      metadata,
      created_by: user.id,
    })
    .select(SESSION_SELECT)
    .single();

  if (sessionErr || !raw) return { error: sessionErr?.message ?? "Failed to create session" };
  const session = normalizeSession(raw as Record<string, unknown>);

  // Create light tasks
  if (params.lightTasks.length > 0) {
    const lightRows = params.lightTasks.map((t, i) => ({
      workspace_id: params.workspaceId,
      title: t.title.trim(),
      session_id: session.id,
      session_origin: "light" as const,
      state: "planned",
      urgency: "normal",
      duration_estimate: t.durationEstimate ?? null,
      scheduled_time: t.scheduledTime ?? null,
      position: i,
      assigned_to: user.id,
      created_by: user.id,
    }));
    const { error: lightErr } = await supabase.from("items").insert(lightRows);
    if (lightErr) return { error: lightErr.message };
  }

  // Link real tasks
  if (params.realTaskIds.length > 0) {
    const junctionRows = params.realTaskIds.map((itemId, i) => ({
      session_id: session.id,
      item_id: itemId,
      position: params.lightTasks.length + i,
    }));
    const { error: jErr } = await supabase.from("session_items").insert(junctionRows);
    if (jErr) return { error: jErr.message };
  }

  return { session };
}

export async function getSessions(params: {
  workspaceId: string;
  date?: string;
}): Promise<{ sessions: SessionData[] } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let q = supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .eq("workspace_id", params.workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (params.date) q = q.eq("scheduled_date", params.date);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { sessions: (data ?? []).map((r) => normalizeSession(r as Record<string, unknown>)) };
}

export async function getSession(
  id: string
): Promise<{ session: SessionData } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: raw, error } = await supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .eq("id", id)
    .single();
  if (error || !raw) return { error: error?.message ?? "Not found" };
  return { session: normalizeSession(raw as Record<string, unknown>) };
}

export async function updateSession(
  id: string,
  updates: Partial<{
    title: string;
    status: string;
    scheduled_date: string | null;
    scheduled_time: string | null;
    duration_estimate: number | null;
    duration_actual: number | null;
    completed_units: number;
    total_units: number | null;
    metadata: Record<string, unknown> | null;
  }>
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("sessions").update(updates).eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteSession(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("sessions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function getSessionItems(
  sessionId: string
): Promise<{ items: ItemData[] } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [lightResult, junctionResult] = await Promise.all([
    supabase
      .from("items")
      .select("*")
      .eq("session_id", sessionId)
      .eq("session_origin", "light")
      .is("deleted_at", null)
      .order("position", { ascending: true }),
    supabase
      .from("session_items")
      .select("position, items!inner(*)")
      .eq("session_id", sessionId)
      .order("position", { ascending: true }),
  ]);

  if (lightResult.error) return { error: lightResult.error.message };
  if (junctionResult.error) return { error: junctionResult.error.message };

  const light = (lightResult.data ?? []).map((r) => normalizeItem(r as Record<string, unknown>));
  const real = (junctionResult.data ?? []).map((r) =>
    normalizeItem(r.items as unknown as Record<string, unknown>)
  );

  return { items: [...light, ...real] };
}

export async function addRealTaskToSession(
  sessionId: string,
  itemId: string,
  position: number
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("session_items")
    .upsert({ session_id: sessionId, item_id: itemId, position });
  return error ? { error: error.message } : { ok: true };
}

export async function removeRealTaskFromSession(
  sessionId: string,
  itemId: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("session_items")
    .delete()
    .eq("session_id", sessionId)
    .eq("item_id", itemId);
  return error ? { error: error.message } : { ok: true };
}

export async function createSessionLightTask(params: {
  workspaceId: string;
  sessionId: string;
  title: string;
  durationEstimate?: number | null;
  scheduledTime?: string | null;
  columnId?: string | null;
  position?: number;
}): Promise<{ item: ItemData } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const metadata = params.columnId ? { session_col: params.columnId } : null;

  const { data: raw, error } = await supabase
    .from("items")
    .insert({
      workspace_id: params.workspaceId,
      title: params.title.trim(),
      session_id: params.sessionId,
      session_origin: "light",
      state: "planned",
      urgency: "normal",
      duration_estimate: params.durationEstimate ?? null,
      scheduled_time: params.scheduledTime ?? null,
      position: params.position ?? 0,
      metadata,
      assigned_to: user.id,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !raw) return { error: error?.message ?? "Failed to create task" };
  return { item: normalizeItem(raw as Record<string, unknown>) };
}

export async function promoteToRealTask(
  itemId: string,
  entityId: string | null
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("items")
    .update({ session_origin: null, entity_id: entityId })
    .eq("id", itemId);
  return error ? { error: error.message } : { ok: true };
}

export async function updateSessionColumns(
  sessionId: string,
  columns: SessionColumn[]
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: current } = await supabase
    .from("sessions")
    .select("metadata")
    .eq("id", sessionId)
    .single();
  const meta = ((current?.metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>;

  const { error } = await supabase
    .from("sessions")
    .update({ metadata: { ...meta, columns } })
    .eq("id", sessionId);
  return error ? { error: error.message } : { ok: true };
}
