"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Clock, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { normalizeItem } from "@/lib/normalize";
import { createSessionFull } from "@/app/actions/sessions";
import type { SessionData, ItemData, EntityData } from "@/lib/types";

interface LightTask {
  id: string;
  title: string;
  duration: string; // raw input, converted to minutes on save
  scheduledTime: string;
}

interface SessionCreateModalProps {
  workspaceId: string;
  defaultDate: string;
  entities: EntityData[];
  onClose: () => void;
  onCreated: (session: SessionData) => void;
}

function parseDuration(raw: string): number | null {
  const n = parseInt(raw, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

export function SessionCreateModal({
  workspaceId,
  defaultDate,
  entities,
  onClose,
  onCreated,
}: SessionCreateModalProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [lightTasks, setLightTasks] = useState<LightTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDuration, setNewTaskDuration] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ItemData[]>([]);
  const [selectedRealIds, setSelectedRealIds] = useState<Set<string>>(new Set());
  const [realTasksMap, setRealTasksMap] = useState<Map<string, ItemData>>(new Map());
  const [customColumns, setCustomColumns] = useState<Array<{ id: string; label: string }>>([]);
  const [newColName, setNewColName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Search existing tasks
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .is("session_origin", null)
      .neq("state", "done")
      .ilike("title", `%${searchQuery}%`)
      .limit(20)
      .then(({ data }) =>
        setSearchResults((data ?? []).map((r) => normalizeItem(r as Record<string, unknown>)))
      );
  }, [searchQuery, workspaceId]);

  function addLightTask() {
    const t = newTaskTitle.trim();
    if (!t) return;
    setLightTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: t, duration: newTaskDuration, scheduledTime: newTaskTime },
    ]);
    setNewTaskTitle("");
    setNewTaskDuration("");
    setNewTaskTime("");
  }

  function removeLightTask(id: string) {
    setLightTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function addCustomColumn() {
    const label = newColName.trim();
    if (!label) return;
    setCustomColumns((prev) => [...prev, { id: crypto.randomUUID(), label }]);
    setNewColName("");
  }

  function removeCustomColumn(id: string) {
    setCustomColumns((prev) => prev.filter((c) => c.id !== id));
  }

  function toggleRealTask(item: ItemData) {
    setSelectedRealIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
        setRealTasksMap((m) => {
          const nm = new Map(m);
          nm.delete(item.id);
          return nm;
        });
      } else {
        next.add(item.id);
        setRealTasksMap((m) => new Map(m).set(item.id, item));
      }
      return next;
    });
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const allColumns = [
      { id: "planned", label: "Planned", is_catchall: true as const },
      ...customColumns.map((c) => ({ id: c.id, label: c.label })),
    ];

    const result = await createSessionFull({
      workspaceId,
      title,
      scheduledDate: date,
      lightTasks: lightTasks.map((t) => ({
        title: t.title,
        durationEstimate: parseDuration(t.duration),
        scheduledTime: t.scheduledTime || null,
      })),
      realTaskIds: Array.from(selectedRealIds),
      columns: customColumns.length > 0 ? allColumns : undefined,
    });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onCreated(result.session);
    onClose();
  }

  const entityById = new Map(entities.map((e) => [e.id, e]));
  const totalCount = lightTasks.length + selectedRealIds.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex flex-none items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">New session</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {/* Title */}
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Session title…"
            className="w-full bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground/40"
          />

          {/* Date */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-border bg-muted px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Light tasks */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tasks
            </p>

            {/* Add light task row */}
            <div className="mb-2 flex items-center gap-2">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLightTask()}
                placeholder="Add a task… (Enter to add)"
                className="min-w-0 flex-1 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-brand-500"
              />
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock size={11} />
                <input
                  type="number"
                  value={newTaskDuration}
                  onChange={(e) => setNewTaskDuration(e.target.value)}
                  placeholder="min"
                  className="w-14 rounded-lg border border-border bg-muted/50 px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-brand-500"
                />
              </div>
              <input
                type="time"
                value={newTaskTime}
                onChange={(e) => setNewTaskTime(e.target.value)}
                className="rounded-lg border border-border bg-muted/50 px-2 py-1.5 text-xs text-foreground outline-none focus:border-brand-500"
              />
              <button
                onClick={addLightTask}
                disabled={!newTaskTitle.trim()}
                className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-brand-500 text-white transition-opacity hover:bg-brand-600 disabled:opacity-30"
              >
                <Plus size={12} />
              </button>
            </div>

            {lightTasks.length > 0 && (
              <div className="space-y-1">
                {lightTasks.map((t, i) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5"
                  >
                    <span className="w-4 flex-none text-center text-[10px] tabular-nums text-muted-foreground/40">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                      {t.title}
                    </span>
                    {t.duration && (
                      <span className="flex-none text-[10px] tabular-nums text-muted-foreground/50">
                        {t.duration}m
                      </span>
                    )}
                    {t.scheduledTime && (
                      <span className="flex-none text-[10px] tabular-nums text-muted-foreground/50">
                        {t.scheduledTime.slice(0, 5)}
                      </span>
                    )}
                    <button
                      onClick={() => removeLightTask(t.id)}
                      className="flex-none text-muted-foreground/30 transition-colors hover:text-destructive"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected real tasks */}
          {selectedRealIds.size > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Existing tasks added ({selectedRealIds.size})
              </p>
              <div className="space-y-1">
                {Array.from(realTasksMap.values()).map((item) => {
                  const entity = item.entity_id ? entityById.get(item.entity_id) : null;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-1.5"
                    >
                      <Check size={11} className="flex-none text-brand-500" />
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                        {item.title}
                      </span>
                      {entity && (
                        <span
                          className="flex-none rounded-full px-1.5 py-0.5 text-[10px] text-white"
                          style={{ backgroundColor: entity.color }}
                        >
                          {entity.name}
                        </span>
                      )}
                      <button
                        onClick={() => toggleRealTask(item)}
                        className="flex-none text-muted-foreground/30 transition-colors hover:text-destructive"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Columns */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kanban columns
            </p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {/* Default column — not deletable */}
              <span className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                Planned
              </span>
              {customColumns.map((col) => (
                <span
                  key={col.id}
                  className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground"
                >
                  {col.label}
                  <button
                    type="button"
                    onClick={() => removeCustomColumn(col.id)}
                    className="ml-0.5 text-muted-foreground/50 transition-colors hover:text-destructive"
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomColumn()}
                placeholder="Add column… (Enter)"
                className="min-w-0 flex-1 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-brand-500"
              />
              <button
                onClick={addCustomColumn}
                disabled={!newColName.trim()}
                className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-brand-500 text-white transition-opacity hover:bg-brand-600 disabled:opacity-30"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Browse existing tasks */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Browse existing tasks
            </p>
            <div className="relative">
              <Search
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50"
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks…"
                className="w-full rounded-lg border border-border bg-muted/50 py-1.5 pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-brand-500"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
                {searchResults.map((item) => {
                  const entity = item.entity_id ? entityById.get(item.entity_id) : null;
                  const selected = selectedRealIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleRealTask(item)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-colors",
                        selected
                          ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-3.5 w-3.5 flex-none items-center justify-center rounded border",
                          selected ? "border-brand-500 bg-brand-500" : "border-muted-foreground/30"
                        )}
                      >
                        {selected && <Check size={9} className="text-white" />}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-xs">{item.title}</span>
                      {entity && (
                        <span
                          className="flex-none rounded-full px-1.5 py-0.5 text-[10px] text-white"
                          style={{ backgroundColor: entity.color }}
                        >
                          {entity.name}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {searchQuery && searchResults.length === 0 && (
              <p className="mt-2 text-center text-xs text-muted-foreground/40">No tasks found</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-none items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {totalCount > 0 ? `${totalCount} task${totalCount !== 1 ? "s" : ""}` : "No tasks yet"}
          </span>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={!title.trim() || saving}
              className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:bg-brand-600 disabled:opacity-40"
            >
              {saving ? "Creating…" : "Create session"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
