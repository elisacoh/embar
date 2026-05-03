import type { ItemData, Subtask, SessionData, SessionColumn } from "./types";

export function normalizeItem(raw: Record<string, unknown>): ItemData {
  return {
    ...(raw as unknown as ItemData),
    session_id: (raw.session_id as string | null) ?? null,
    session_origin: (raw.session_origin as "light" | null) ?? null,
    subtasks: (raw.subtasks as Subtask[] | null) ?? [],
    hard_deadline: (raw.hard_deadline as boolean | null) ?? false,
    is_fixed: (raw.is_fixed as boolean | null) ?? false,
    duration_actual: (raw.duration_actual as number | null) ?? null,
    completed_at: (raw.completed_at as string | null) ?? null,
    metadata: (raw.metadata as Record<string, unknown> | null) ?? null,
    time_spent_ms: (raw.time_spent_ms as number | null) ?? 0,
    position: (raw.position as number | null) ?? 0,
  };
}

export function normalizeSession(raw: Record<string, unknown>): SessionData {
  const metadata = (raw.metadata as Record<string, unknown> | null) ?? {};
  return {
    ...(raw as unknown as SessionData),
    entity_id: (raw.entity_id as string | null) ?? null,
    scheduled_time: (raw.scheduled_time as string | null) ?? null,
    duration_estimate: (raw.duration_estimate as number | null) ?? null,
    duration_actual: (raw.duration_actual as number | null) ?? null,
    completed_units: (raw.completed_units as number | null) ?? 0,
    total_units: (raw.total_units as number | null) ?? null,
    columns: (metadata.columns as SessionColumn[] | undefined) ?? [],
    metadata,
    ai_summary: (raw.ai_summary as string | null) ?? null,
    deleted_at: (raw.deleted_at as string | null) ?? null,
  };
}
