"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Play,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  Plus,
  Trash2,
  GripVertical,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  updateSession,
  updateSessionColumns,
  getSessionItems,
  createSessionLightTask,
} from "@/app/actions/sessions";
import type { SessionData, ItemData, SessionColumn } from "@/lib/types";

const DURATION_PRESETS = [
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
];

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-20 flex-none pt-0.5 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

interface SessionDetailPanelProps {
  session: SessionData;
  cachedItems?: ItemData[];
  onClose: () => void;
  onStart: () => void;
  onUpdated?: (s: SessionData) => void;
  onTaskAdded?: (item: ItemData) => void;
  onItemsFetched?: (items: ItemData[]) => void;
}

export function SessionDetailPanel({
  session,
  cachedItems,
  onClose,
  onStart,
  onUpdated,
  onTaskAdded,
  onItemsFetched,
}: SessionDetailPanelProps) {
  const [draft, setDraft] = useState<SessionData>(session);
  const [tasks, setTasks] = useState<ItemData[]>(cachedItems ?? []);
  const [loadingTasks, setLoadingTasks] = useState(!cachedItems);
  const [saved, setSaved] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [columns, setColumns] = useState<SessionColumn[]>(session.columns);
  const [newColLabel, setNewColLabel] = useState("");
  const [colDragOverIdx, setColDragOverIdx] = useState<number | null>(null);

  // Refs — never stale in event handlers
  const pendingRef = useRef<Partial<Parameters<typeof updateSession>[1]>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const colDragIdxRef = useRef<number | null>(null);
  const columnsRef = useRef<SessionColumn[]>(session.columns);
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const newColInputRef = useRef<HTMLInputElement>(null);

  // Keep columnsRef in sync so drag handlers always read fresh value
  columnsRef.current = columns;

  // Fetch tasks — show cached immediately, then revalidate
  useEffect(() => {
    setLoadingTasks(!cachedItems);
    getSessionItems(session.id).then((r) => {
      if ("items" in r) {
        setTasks(r.items);
        onItemsFetched?.(r.items);
      }
      setLoadingTasks(false);
    });
  }, [session.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function flashSaved() {
    setSaved(true);
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1800);
  }

  function save(updates: Partial<Parameters<typeof updateSession>[1]>) {
    const next = { ...draft, ...updates } as SessionData;
    setDraft(next);
    pendingRef.current = { ...pendingRef.current, ...updates };
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const toSave = pendingRef.current;
      pendingRef.current = {};
      void updateSession(session.id, toSave).then(() => {
        onUpdated?.(next);
        flashSaved();
      });
    }, 800);
  }

  function flushAndClose() {
    if (Object.keys(pendingRef.current).length > 0) {
      clearTimeout(saveTimerRef.current);
      const toSave = pendingRef.current;
      pendingRef.current = {};
      void updateSession(session.id, toSave).then(() =>
        onUpdated?.({ ...draft, ...toSave } as SessionData)
      );
    }
    onClose();
  }

  function persistColumns(newCols: SessionColumn[]) {
    setColumns(newCols);
    columnsRef.current = newCols;
    const next = { ...draft, columns: newCols } as SessionData;
    setDraft(next);
    void updateSessionColumns(session.id, newCols).then(() => {
      onUpdated?.(next);
      flashSaved();
    });
  }

  function handleColLabelChange(id: string, label: string) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)));
  }

  function handleColLabelBlur(id: string, label: string) {
    if (!label.trim()) return;
    persistColumns(
      columnsRef.current.map((c) => (c.id === id ? { ...c, label: label.trim() } : c))
    );
  }

  function handleDeleteColumn(id: string) {
    persistColumns(columnsRef.current.filter((c) => c.id !== id));
  }

  function handleAddColumn() {
    if (!newColLabel.trim()) return;
    const newCol: SessionColumn = { id: crypto.randomUUID(), label: newColLabel.trim() };
    persistColumns([...columnsRef.current, newCol]);
    setNewColLabel("");
    newColInputRef.current?.focus();
  }

  // Column drag-to-reorder — use refs to avoid stale closures
  function handleColDragStart(e: React.DragEvent, idx: number) {
    e.stopPropagation();
    colDragIdxRef.current = idx;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleColDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    const from = colDragIdxRef.current;
    colDragIdxRef.current = null;
    setColDragOverIdx(null);
    if (from === null || from === targetIdx) return;
    const reordered = [...columnsRef.current];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(targetIdx, 0, moved!);
    persistColumns(reordered);
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title || savingTask) return;
    setSavingTask(true);
    const result = await createSessionLightTask({
      workspaceId: session.workspace_id,
      sessionId: session.id,
      title,
      position: tasks.length,
    });
    if ("item" in result) {
      setTasks((prev) => [...prev, result.item]);
      onTaskAdded?.(result.item);
    }
    setNewTaskTitle("");
    setSavingTask(false);
    newTaskInputRef.current?.focus();
  }

  const completedCount = tasks.filter((t) => t.state === "done").length;
  const totalCount = tasks.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 flex-none items-center gap-2 border-b border-border px-4">
        <button
          onClick={flushAndClose}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={14} />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {draft.title}
        </span>
        {saved && (
          <span className="flex flex-none items-center gap-1 text-[10px] font-medium text-green-500">
            <Check size={10} />
            Saved
          </span>
        )}
        <button
          onClick={onStart}
          className="flex flex-none items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
        >
          <Play size={11} />
          {session.status === "active" ? "Continue" : "Start"}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Title */}
        <input
          value={draft.title}
          onChange={(e) => save({ title: e.target.value })}
          className="w-full bg-transparent text-lg font-semibold text-foreground outline-none placeholder:text-muted-foreground/40"
          placeholder="Session title…"
        />

        {/* Meta */}
        <div className="space-y-3">
          <FieldRow label="Date">
            <span className="flex items-center gap-1.5 text-sm text-foreground">
              <Calendar size={12} className="text-muted-foreground" />
              {draft.scheduled_date}
            </span>
          </FieldRow>

          {draft.scheduled_time && (
            <FieldRow label="Time">
              <span className="flex items-center gap-1.5 text-sm text-foreground">
                <Clock size={12} className="text-muted-foreground" />
                {draft.scheduled_time}
              </span>
            </FieldRow>
          )}

          <FieldRow label="Duration">
            <div className="flex flex-wrap items-center gap-1.5">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => save({ duration_estimate: p.value })}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                    draft.duration_estimate === p.value
                      ? "bg-brand-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {p.label}
                </button>
              ))}
              {draft.duration_estimate != null &&
                !DURATION_PRESETS.find((p) => p.value === draft.duration_estimate) && (
                  <span className="text-sm text-muted-foreground">{draft.duration_estimate}m</span>
                )}
            </div>
          </FieldRow>
        </div>

        {/* Columns */}
        {columns.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Columns</p>
            <div className="space-y-1">
              {columns.map((col, idx) => (
                <div
                  key={col.id}
                  draggable
                  onDragStart={(e) => handleColDragStart(e, idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setColDragOverIdx(idx);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setColDragOverIdx(null);
                  }}
                  onDrop={(e) => handleColDrop(e, idx)}
                  onDragEnd={() => {
                    colDragIdxRef.current = null;
                    setColDragOverIdx(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors",
                    colDragOverIdx === idx
                      ? "border-brand-400/50 bg-brand-500/5"
                      : "border-transparent hover:border-border"
                  )}
                >
                  <GripVertical
                    size={12}
                    className="flex-none cursor-grab text-muted-foreground/30 active:cursor-grabbing"
                  />
                  <input
                    value={col.label}
                    onChange={(e) => handleColLabelChange(col.id, e.target.value)}
                    onBlur={(e) => handleColLabelBlur(col.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className={cn(
                      "min-w-0 flex-1 bg-transparent text-sm outline-none",
                      col.is_catchall ? "text-muted-foreground" : "text-foreground"
                    )}
                  />
                  {col.is_catchall ? (
                    <span className="flex-none rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground/60">
                      default
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDeleteColumn(col.id)}
                      className="flex-none text-muted-foreground/30 transition-colors hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add column */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                ref={newColInputRef}
                value={newColLabel}
                onChange={(e) => setNewColLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddColumn();
                }}
                placeholder="New column…"
                className="min-w-0 flex-1 rounded-lg border border-dashed border-border bg-transparent px-2 py-1.5 text-xs text-muted-foreground/60 outline-none placeholder:text-muted-foreground/30 focus:border-brand-400/50 focus:text-foreground"
              />
              <button
                onClick={handleAddColumn}
                disabled={!newColLabel.trim()}
                className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Progress */}
        {totalCount > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Progress</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {completedCount}/{totalCount}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Tasks */}
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Tasks</p>

          {loadingTasks && tasks.length === 0 ? (
            <p className="mb-2 text-xs text-muted-foreground/40">Loading…</p>
          ) : tasks.length > 0 ? (
            <div className="mb-2 space-y-0.5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                >
                  {task.state === "done" ? (
                    <CheckCircle2 size={13} className="flex-none text-green-500" />
                  ) : (
                    <Circle size={13} className="flex-none text-muted-foreground/30" />
                  )}
                  <span
                    className={cn(
                      "text-sm leading-snug",
                      task.state === "done" && "text-muted-foreground/50 line-through"
                    )}
                  >
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          ) : !loadingTasks ? (
            <p className="mb-2 text-xs text-muted-foreground/40">
              No tasks yet — start the session to add some
            </p>
          ) : null}

          {/* Add task inline */}
          <div className="flex items-center gap-1.5">
            <input
              ref={newTaskInputRef}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddTask();
              }}
              placeholder="Add a task…"
              disabled={savingTask}
              className="min-w-0 flex-1 rounded-lg border border-dashed border-border bg-transparent px-2 py-1.5 text-xs text-muted-foreground/60 outline-none placeholder:text-muted-foreground/30 focus:border-brand-400/50 focus:text-foreground disabled:opacity-50"
            />
            <button
              onClick={() => void handleAddTask()}
              disabled={!newTaskTitle.trim() || savingTask}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* AI summary */}
        {draft.ai_summary && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Summary</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{draft.ai_summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}
