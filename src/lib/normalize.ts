import type { ItemData, Subtask } from "./types";

/**
 * Normalise a raw DB row into a fully-typed ItemData.
 * Applied in every fetch layer so components never see null for array fields.
 */
export function normalizeItem(raw: Record<string, unknown>): ItemData {
  return {
    ...(raw as unknown as ItemData),
    subtasks: (raw.subtasks as Subtask[] | null) ?? [],
    hard_deadline: (raw.hard_deadline as boolean | null) ?? false,
    is_fixed: (raw.is_fixed as boolean | null) ?? false,
    metadata: (raw.metadata as Record<string, unknown> | null) ?? null,
  };
}
