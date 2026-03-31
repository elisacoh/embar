"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  SortAsc,
  LayoutList,
  CheckSquare,
  Square,
  Trash2,
  Calendar,
  Tag,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeItem } from "@/lib/normalize";
import { updateItem, deleteItem } from "@/app/actions/items";
import { cn } from "@/lib/utils";
import type { EntityData, ItemData } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────────────────────

type SortKey = "due_date" | "created_at" | "urgency" | "title";
type GroupKey = "entity" | "state" | "work_type" | "urgency" | "none";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "created_at", label: "Created date" },
  { value: "due_date", label: "Due date" },
  { value: "urgency", label: "Urgency" },
  { value: "title", label: "Title" },
];

const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: "entity", label: "Entity" },
  { value: "state", label: "State" },
  { value: "work_type", label: "Work type" },
  { value: "urgency", label: "Urgency" },
  { value: "none", label: "None" },
];

const URGENCY_ORDER: Record<string, number> = { critical: 0, urgent: 1, normal: 2 };
const STATE_ORDER: Record<string, number> = {
  focus: 0,
  planned: 1,
  "carry-on": 2,
  unplanned: 3,
  someday: 4,
  done: 5,
};
const WORK_TYPE_ORDER: Record<string, number> = { deep: 0, shallow: 1, admin: 2 };

const STATE_LABELS: Record<string, string> = {
  focus: "Focus",
  planned: "Planned",
  "carry-on": "Carry-on",
  unplanned: "Later",
  someday: "Someday",
  done: "Done",
};
const STATE_COLORS: Record<string, string> = {
  focus: "bg-brand-500",
  planned: "bg-blue-500",
  "carry-on": "bg-red-500",
  unplanned: "bg-muted-foreground/40",
  someday: "bg-purple-500",
  done: "bg-green-500",
};
const STATE_BADGE: Record<string, string> = {
  focus: "bg-brand-500/10 text-brand-600 dark:text-brand-400",
  planned: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "carry-on": "bg-red-500/10 text-red-600 dark:text-red-400",
  unplanned: "bg-muted text-muted-foreground",
  someday: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  done: "bg-green-500/10 text-green-600 dark:text-green-400",
};
const WORK_TYPE_BADGE: Record<string, string> = {
  deep: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  shallow: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  admin: "bg-muted text-muted-foreground",
};
const URGENCY_BADGE: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  urgent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Row component ─────────────────────────────────────────────────────────────

interface AllRowProps {
  item: ItemData;
  entity: EntityData | null;
  isSelected: boolean;
  onCheck: (checked: boolean) => void;
  onSelect: () => void;
}

function AllRow({ item, entity, isSelected, onCheck, onSelect }: AllRowProps) {
  const isDone = item.state === "done";

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex cursor-pointer items-center gap-3 border-b border-border/50 px-4 py-2 transition-colors hover:bg-muted/30",
        isSelected && "bg-brand-500/5",
        isDone && "opacity-60"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCheck(!isSelected);
        }}
        className="flex-none text-muted-foreground/40 transition-colors hover:text-brand-500"
      >
        {isSelected ? <CheckSquare size={14} className="text-brand-500" /> : <Square size={14} />}
      </button>

      {/* State dot */}
      <span
        className={cn(
          "h-1.5 w-1.5 flex-none rounded-full",
          STATE_COLORS[item.state] ?? "bg-muted-foreground/40"
        )}
      />

      {/* Title */}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          isDone && "text-muted-foreground line-through"
        )}
      >
        {item.title}
      </span>

      {/* Badges */}
      <div className="flex flex-none items-center gap-1.5">
        {/* State badge */}
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            STATE_BADGE[item.state] ?? "bg-muted text-muted-foreground"
          )}
        >
          {STATE_LABELS[item.state] ?? item.state}
        </span>

        {/* Work type */}
        {item.work_type && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              WORK_TYPE_BADGE[item.work_type] ?? "bg-muted text-muted-foreground"
            )}
          >
            {item.work_type}
          </span>
        )}

        {/* Urgency */}
        {item.urgency !== "normal" && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              URGENCY_BADGE[item.urgency] ?? "bg-muted text-muted-foreground"
            )}
          >
            {item.urgency}
          </span>
        )}

        {/* Due date */}
        {item.due_date && (
          <span
            className={cn(
              "text-[11px] tabular-nums text-muted-foreground",
              new Date(item.due_date + "T00:00:00") < new Date() && "text-destructive"
            )}
          >
            {formatDate(item.due_date)}
          </span>
        )}

        {/* Entity */}
        {entity && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span
              className="h-1.5 w-1.5 flex-none rounded-full"
              style={{ backgroundColor: entity.color }}
            />
            {entity.name}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AllViewProps {
  workspaceId: string;
  entityId: string | null;
  entities: EntityData[];
  onSelectItem: (id: string) => void;
  selectedItemId: string | null; // eslint-disable-line @typescript-eslint/no-unused-vars
}

export function AllView({ workspaceId, entityId, entities, onSelectItem }: AllViewProps) {
  const [items, setItems] = useState<ItemData[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [groupBy, setGroupBy] = useState<GroupKey>("entity");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["__all__"]));
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkRescheduleDate, setBulkRescheduleDate] = useState("");
  const [bulkEntityTarget, setBulkEntityTarget] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [showChangeEntity, setShowChangeEntity] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();

    let q = supabase
      .from("items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (entityId) q = q.eq("entity_id", entityId);

    q.then(({ data }) =>
      setItems((data ?? []).map((r) => normalizeItem(r as Record<string, unknown>)))
    );

    const channel = supabase
      .channel(`all:${workspaceId}:${entityId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "items",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const item = normalizeItem(payload.new as Record<string, unknown>);
          if (entityId && item.entity_id !== entityId) return;
          setItems((prev) => (prev.find((i) => i.id === item.id) ? prev : [item, ...prev]));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "items",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const updated = normalizeItem(payload.new as Record<string, unknown>);
          if (entityId && updated.entity_id !== entityId) {
            setItems((prev) => prev.filter((i) => i.id !== updated.id));
            return;
          }
          setItems((prev) => {
            const exists = prev.some((i) => i.id === updated.id);
            return exists
              ? prev.map((i) => (i.id === updated.id ? updated : i))
              : [updated, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "items",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => setItems((prev) => prev.filter((i) => i.id !== payload.old.id))
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, entityId]);

  // ── Filtering + Sorting + Grouping ────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.title.toLowerCase().includes(q)) : items;
  }, [items, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "due_date": {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        }
        case "created_at":
          return b.created_at.localeCompare(a.created_at);
        case "urgency":
          return (URGENCY_ORDER[a.urgency] ?? 2) - (URGENCY_ORDER[b.urgency] ?? 2);
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [filtered, sortBy]);

  interface GroupData {
    key: string;
    label: string;
    items: ItemData[];
  }

  const groups = useMemo((): GroupData[] => {
    if (groupBy === "none") {
      return [{ key: "__all__", label: "All Tasks", items: sorted }];
    }

    const map = new Map<string, ItemData[]>();

    for (const item of sorted) {
      let key: string;
      switch (groupBy) {
        case "entity":
          key = item.entity_id ?? "__none__";
          break;
        case "state":
          key = item.state;
          break;
        case "work_type":
          key = item.work_type ?? "__none__";
          break;
        case "urgency":
          key = item.urgency;
          break;
        default:
          key = "__none__";
      }
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }

    const result: GroupData[] = [];
    for (const [key, groupItems] of Array.from(map.entries())) {
      let label: string;
      switch (groupBy) {
        case "entity": {
          const ent = entities.find((e) => e.id === key);
          label = ent?.name ?? "No Entity";
          break;
        }
        case "state":
          label = STATE_LABELS[key] ?? key;
          break;
        case "work_type":
          label = key === "__none__" ? "No type" : key.charAt(0).toUpperCase() + key.slice(1);
          break;
        case "urgency":
          label = key.charAt(0).toUpperCase() + key.slice(1);
          break;
        default:
          label = key;
      }
      result.push({ key, label, items: groupItems });
    }

    // Sort groups
    return result.sort((a, b) => {
      switch (groupBy) {
        case "entity":
          return a.label.localeCompare(b.label);
        case "state":
          return (STATE_ORDER[a.key] ?? 99) - (STATE_ORDER[b.key] ?? 99);
        case "work_type":
          return (WORK_TYPE_ORDER[a.key] ?? 99) - (WORK_TYPE_ORDER[b.key] ?? 99);
        case "urgency":
          return (URGENCY_ORDER[a.key] ?? 99) - (URGENCY_ORDER[b.key] ?? 99);
        default:
          return 0;
      }
    });
  }, [sorted, groupBy, entities]);

  // Auto-expand all groups when groupBy changes
  useEffect(() => {
    setExpandedGroups(new Set(groups.map((g) => g.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy]);

  // ── Selection ─────────────────────────────────────────────────────────────

  function toggleItem(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)));
    }
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  function handleBulkReschedule() {
    if (!bulkRescheduleDate) return;
    const ids = Array.from(selectedIds);
    const updates = { scheduled_date: bulkRescheduleDate, state: "planned" };
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, ...updates } : i)));
    for (const id of ids) void updateItem(id, updates);
    setSelectedIds(new Set());
    setShowReschedule(false);
    setBulkRescheduleDate("");
  }

  function handleBulkChangeEntity() {
    if (!bulkEntityTarget) return;
    const ids = Array.from(selectedIds);
    const entityIdValue = bulkEntityTarget === "__none__" ? null : bulkEntityTarget;
    setItems((prev) =>
      prev.map((i) => (ids.includes(i.id) ? { ...i, entity_id: entityIdValue } : i))
    );
    for (const id of ids) void updateItem(id, { entity_id: entityIdValue });
    setSelectedIds(new Set());
    setShowChangeEntity(false);
    setBulkEntityTarget("");
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    setDeleting(true);
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    await Promise.all(ids.map((id) => deleteItem(id)));
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
    setDeleting(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const allFilteredSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0;
  const TODAY = toLocalDateStr(new Date());

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-none items-center gap-3 border-b border-border px-4 py-2.5">
        {/* Select all */}
        <button
          onClick={selectAll}
          className="flex-none text-muted-foreground/50 transition-colors hover:text-brand-500"
          title={allFilteredSelected ? "Deselect all" : "Select all"}
        >
          {allFilteredSelected ? (
            <CheckSquare size={14} className="text-brand-500" />
          ) : (
            <Square size={14} />
          )}
        </button>

        {/* Search */}
        <div className="relative min-w-0 flex-1">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
          />
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <SortAsc size={12} className="text-muted-foreground/60" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="cursor-pointer appearance-none rounded-lg border border-border bg-background py-1.5 pl-2 pr-6 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Group by */}
        <div className="flex items-center gap-1.5">
          <LayoutList size={12} className="text-muted-foreground/60" />
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupKey)}
            className="cursor-pointer appearance-none rounded-lg border border-border bg-background py-1.5 pl-2 pr-6 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {GROUP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Count */}
        <span className="flex-none text-xs text-muted-foreground/60">
          {filtered.length} task{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Bulk action bar ──────────────────────────────────────────── */}
      {someSelected && (
        <div className="flex flex-none items-center gap-2 border-b border-border bg-brand-500/5 px-4 py-2">
          <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
            {selectedIds.size} selected
          </span>

          <div className="mx-2 h-4 w-px bg-border" />

          {/* Reschedule */}
          {showReschedule ? (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                min={TODAY}
                value={bulkRescheduleDate}
                onChange={(e) => setBulkRescheduleDate(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                onClick={handleBulkReschedule}
                disabled={!bulkRescheduleDate}
                className="rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setShowReschedule(false);
                  setBulkRescheduleDate("");
                }}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : showChangeEntity ? (
            <div className="flex items-center gap-1.5">
              <select
                value={bulkEntityTarget}
                onChange={(e) => setBulkEntityTarget(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Pick entity…</option>
                <option value="__none__">No entity</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkChangeEntity}
                disabled={!bulkEntityTarget}
                className="rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setShowChangeEntity(false);
                  setBulkEntityTarget("");
                }}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : bulkDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Delete {selectedIds.size} task{selectedIds.size !== 1 ? "s" : ""}?
              </span>
              <button
                onClick={() => void handleBulkDelete()}
                disabled={deleting}
                className="rounded-lg bg-destructive px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Confirm"}
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setShowReschedule(true);
                  setShowChangeEntity(false);
                  setBulkDeleteConfirm(false);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Calendar size={11} />
                Reschedule
              </button>
              <button
                onClick={() => {
                  setShowChangeEntity(true);
                  setShowReschedule(false);
                  setBulkDeleteConfirm(false);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Tag size={11} />
                Change entity
              </button>
              <button
                onClick={() => {
                  setBulkDeleteConfirm(true);
                  setShowReschedule(false);
                  setShowChangeEntity(false);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 size={11} />
                Delete
              </button>
            </>
          )}

          <button
            onClick={() => {
              setSelectedIds(new Set());
              setShowReschedule(false);
              setShowChangeEntity(false);
              setBulkDeleteConfirm(false);
            }}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── List ────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <AlertTriangle size={24} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? `No tasks match "${search}"` : "No tasks yet"}
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.key}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className="flex w-full items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-left transition-colors hover:bg-muted/50"
              >
                <ChevronDown
                  size={13}
                  className={cn(
                    "flex-none text-muted-foreground transition-transform duration-150",
                    !expandedGroups.has(group.key) && "-rotate-90"
                  )}
                />
                {groupBy === "entity" &&
                  (() => {
                    const ent = entities.find((e) => e.id === group.key);
                    return ent ? (
                      <span
                        className="h-2 w-2 flex-none rounded-full"
                        style={{ backgroundColor: ent.color }}
                      />
                    ) : null;
                  })()}
                {groupBy === "state" && (
                  <span
                    className={cn(
                      "h-2 w-2 flex-none rounded-full",
                      STATE_COLORS[group.key] ?? "bg-muted-foreground/40"
                    )}
                  />
                )}
                <span className="text-xs font-semibold text-foreground">{group.label}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {group.items.length}
                </span>

                {/* Select all in group */}
                {expandedGroups.has(group.key) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const allSelected = group.items.every((i) => selectedIds.has(i.id));
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (allSelected) {
                          group.items.forEach((i) => next.delete(i.id));
                        } else {
                          group.items.forEach((i) => next.add(i.id));
                        }
                        return next;
                      });
                    }}
                    className="ml-auto text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
                  >
                    {group.items.every((i) => selectedIds.has(i.id))
                      ? "Deselect group"
                      : "Select group"}
                  </button>
                )}
              </button>

              {/* Rows */}
              {expandedGroups.has(group.key) &&
                group.items.map((item) => {
                  const entity = entities.find((e) => e.id === item.entity_id) ?? null;
                  return (
                    <AllRow
                      key={item.id}
                      item={item}
                      entity={entity}
                      isSelected={selectedIds.has(item.id)}
                      onCheck={(checked) => toggleItem(item.id, checked)}
                      onSelect={() => onSelectItem(item.id)}
                    />
                  );
                })}
            </div>
          ))
        )}
        <div className="h-28" /> {/* Bottom padding for AI bar */}
      </div>
    </div>
  );
}
