"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUpRight,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { normalizeItem } from "@/lib/normalize";
import {
  getSessionItems,
  createSessionLightTask,
  updateSession,
  updateSessionColumns,
  promoteToRealTask,
} from "@/app/actions/sessions";
import { updateItem } from "@/app/actions/items";
import type { SessionData, SessionColumn, ItemData, EntityData } from "@/lib/types";

// ── helpers ──────────────────────────────────────────────────────────────────

const SCHEDULE_START = 6;
const SCHEDULE_END = 21;
const PX_PER_HOUR = 60;
const HOURS = Array.from({ length: SCHEDULE_END - SCHEDULE_START }, (_, i) => i + SCHEDULE_START);

function timeToTop(time: string) {
  const [h, m] = time.split(":").map(Number);
  return ((h ?? 0) - SCHEDULE_START) * PX_PER_HOUR + ((m ?? 0) / 60) * PX_PER_HOUR;
}

function formatDuration(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = (h ?? 0) < 12 ? "am" : "pm";
  const h12 = (h ?? 0) % 12 || 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")}${ampm}`;
}

// Column item state mapping
function stateForColumn(colId: string): string {
  if (colId === "focus") return "focus";
  if (colId === "done") return "done";
  return "planned"; // catchall + custom
}

function getItemColumnId(item: ItemData, columns: SessionColumn[]): string {
  if (item.state === "focus") return "focus";
  if (item.state === "done") return "done";
  const sessionCol = item.metadata?.session_col as string | undefined;
  if (sessionCol && columns.some((c) => c.id === sessionCol)) return sessionCol;
  const catchall = columns.find((c) => c.is_catchall);
  return catchall?.id ?? "planned";
}

// ── Task card inside session ─────────────────────────────────────────────────

interface SessionTaskCardProps {
  item: ItemData;
  entities: EntityData[];
  dragging: boolean;
  dragTarget: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onComplete: () => void;
  onSelect: () => void;
  onPromote: () => void;
}

function SessionTaskCard({
  item,
  entities,
  dragging,
  dragTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onComplete,
  onSelect,
  onPromote,
}: SessionTaskCardProps) {
  const isDone = item.state === "done";
  const entity = item.entity_id ? entities.find((e) => e.id === item.entity_id) : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onClick={onSelect}
      className={cn(
        "group relative cursor-pointer select-none rounded-xl border bg-card px-3 py-2 transition-all",
        "hover:shadow-sm",
        isDone ? "border-border opacity-50" : "border-border",
        dragging && "opacity-30",
        dragTarget && "ring-1 ring-brand-500"
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical
          size={12}
          className="mt-0.5 flex-none cursor-grab text-muted-foreground/20 group-hover:text-muted-foreground/50"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          className="mt-0.5 flex-none"
        >
          <div
            className={cn(
              "flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 transition-all",
              isDone
                ? "border-green-500 bg-green-500"
                : "border-muted-foreground/30 hover:border-brand-500"
            )}
          >
            {isDone && <Check size={8} className="text-white" strokeWidth={3} />}
          </div>
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs leading-snug",
              isDone ? "text-muted-foreground line-through" : "text-foreground"
            )}
          >
            {item.title}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            {item.duration_estimate != null && (
              <span className="text-[10px] tabular-nums text-muted-foreground/40">
                {formatDuration(item.duration_estimate)}
              </span>
            )}
            {item.scheduled_time && (
              <span className="text-[10px] tabular-nums text-muted-foreground/40">
                {formatTime(item.scheduled_time)}
              </span>
            )}
            {entity && (
              <span
                className="rounded-full px-1.5 py-px text-[9px] text-white"
                style={{ backgroundColor: entity.color }}
              >
                {entity.name}
              </span>
            )}
          </div>
        </div>
        {item.session_origin === "light" && (
          <button
            title="Promote to real task"
            onClick={(e) => {
              e.stopPropagation();
              onPromote();
            }}
            className="flex-none text-muted-foreground opacity-0 transition-opacity hover:text-brand-500 group-hover:opacity-100"
          >
            <ArrowUpRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Kanban column ────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  colId: string;
  label: string;
  items: ItemData[];
  entities: EntityData[];
  workspaceId: string;
  sessionId: string;
  isFixed: boolean;
  draggingId: string | null;
  dragOverItemId: string | null;
  dragOverColId: string | null;
  onDragStart: (e: React.DragEvent, item: ItemData) => void;
  onDragEnd: () => void;
  onDragOverItem: (e: React.DragEvent, itemId: string) => void;
  onDragOverCol: (e: React.DragEvent, colId: string) => void;
  onDropCol: (colId: string) => void;
  onComplete: (item: ItemData) => void;
  onSelect: (item: ItemData) => void;
  onPromote: (item: ItemData) => void;
  onTaskAdded: (item: ItemData) => void;
  onRemove?: () => void;
}

function KanbanColumn({
  colId,
  label,
  items,
  entities,
  workspaceId,
  sessionId,
  isFixed,
  draggingId,
  dragOverItemId,
  dragOverColId,
  onDragStart,
  onDragEnd,
  onDragOverItem,
  onDragOverCol,
  onDropCol,
  onComplete,
  onSelect,
  onPromote,
  onTaskAdded,
  onRemove,
}: KanbanColumnProps) {
  const [addingTask, setAddingTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newTime, setNewTime] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingTask) inputRef.current?.focus();
  }, [addingTask]);

  async function handleAddTask() {
    const t = newTitle.trim();
    if (!t) {
      setAddingTask(false);
      return;
    }
    const dur = parseInt(newDuration, 10);
    const result = await createSessionLightTask({
      workspaceId,
      sessionId,
      title: t,
      durationEstimate: isNaN(dur) ? null : dur,
      scheduledTime: newTime || null,
      columnId: isFixed ? null : colId,
      position: items.length,
    });
    if ("item" in result) {
      onTaskAdded(result.item);
    }
    setNewTitle("");
    setNewDuration("");
    setNewTime("");
    setAddingTask(false);
  }

  const isDropTarget = dragOverColId === colId && !dragOverItemId;

  return (
    <div
      className={cn(
        "flex w-64 flex-none flex-col rounded-xl border border-border bg-muted/20 transition-colors",
        isDropTarget && draggingId && "border-brand-400 bg-brand-500/5"
      )}
      onDragOver={(e) => onDragOverCol(e, colId)}
      onDrop={() => onDropCol(colId)}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          {colId === "focus" && <div className="h-2 w-2 rounded-full bg-brand-500" />}
          {colId === "done" && <div className="h-2 w-2 rounded-full bg-green-500" />}
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className="text-[10px] tabular-nums text-muted-foreground/50">{items.length}</span>
        </div>
        {!isFixed && onRemove && (
          <button
            onClick={onRemove}
            className="text-muted-foreground/30 transition-colors hover:text-destructive"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
        {items.map((item) => (
          <SessionTaskCard
            key={item.id}
            item={item}
            entities={entities}
            dragging={draggingId === item.id}
            dragTarget={dragOverItemId === item.id && draggingId !== item.id}
            onDragStart={(e) => onDragStart(e, item)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => onDragOverItem(e, item.id)}
            onComplete={() => onComplete(item)}
            onSelect={() => onSelect(item)}
            onPromote={() => onPromote(item)}
          />
        ))}

        {/* Drop zone */}
        {draggingId && items.length === 0 && (
          <div className="flex h-12 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground/30">
            Drop here
          </div>
        )}

        {/* Add task inline */}
        {addingTask ? (
          <div className="space-y-1 rounded-xl border border-brand-500/30 bg-brand-500/5 p-2">
            <input
              ref={inputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddTask();
                if (e.key === "Escape") {
                  setAddingTask(false);
                  setNewTitle("");
                }
              }}
              placeholder="Task title…"
              className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                placeholder="min"
                className="w-14 rounded bg-transparent text-[11px] text-muted-foreground outline-none placeholder:text-muted-foreground/30"
              />
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="rounded bg-transparent text-[11px] text-muted-foreground outline-none"
              />
              <button
                onClick={() => void handleAddTask()}
                className="ml-auto text-[11px] font-medium text-brand-500 hover:text-brand-600"
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingTask(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground/40 transition-colors hover:bg-muted hover:text-muted-foreground"
          >
            <Plus size={11} />
            Add task
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main SessionView ─────────────────────────────────────────────────────────

interface SessionViewProps {
  session: SessionData;
  workspaceId: string;
  entities: EntityData[];
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
  onSessionUpdated: (s: SessionData) => void;
}

export function SessionView({
  session,
  workspaceId,
  entities,
  onSelectItem,
  onSessionUpdated,
}: SessionViewProps) {
  const [items, setItems] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [scheduleWidth, setScheduleWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");
  const [promotingItemId, setPromotingItemId] = useState<string | null>(null);
  const scheduleScrollRef = useRef<HTMLDivElement>(null);
  const colInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingColumn) colInputRef.current?.focus();
  }, [addingColumn]);

  // Fetch items
  useEffect(() => {
    setLoading(true);
    getSessionItems(session.id).then((result) => {
      if ("items" in result) setItems(result.items);
      setLoading(false);
    });
  }, [session.id]);

  // Realtime for session light tasks
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`session:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "items",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const updated = normalizeItem(payload.new as Record<string, unknown>);
          setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session.id]);

  // Build columns: focus (fixed) | catchall + customs | done (fixed)
  const customColumns: SessionColumn[] = session.columns;
  const hasCatchall = customColumns.some((c) => c.is_catchall);
  const allColumns: Array<SessionColumn & { fixed: boolean }> = [
    { id: "focus", label: "Focus", fixed: true },
    ...(hasCatchall
      ? customColumns
      : [{ id: "planned", label: "Planned", is_catchall: true } as SessionColumn, ...customColumns]
    ).map((c) => ({ ...c, fixed: false })),
    { id: "done", label: "Done", fixed: true },
  ];

  function itemsForColumn(colId: string) {
    return items.filter((item) => getItemColumnId(item, allColumns) === colId);
  }

  // Scheduled items for timeline
  const scheduledItems = items
    .filter((i) => i.scheduled_time)
    .sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? ""));

  // ── Drag handlers ────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, item: ItemData) {
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(item.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverItemId(null);
    setDragOverColId(null);
  }

  function handleDragOverItem(e: React.DragEvent, itemId: string) {
    e.preventDefault();
    setDragOverItemId(itemId);
    setDragOverColId(null);
  }

  function handleDragOverCol(e: React.DragEvent, colId: string) {
    e.preventDefault();
    setDragOverColId(colId);
    setDragOverItemId(null);
  }

  async function handleDropToColumn(targetColId: string) {
    if (!draggingId) return;
    setDraggingId(null);
    setDragOverColId(null);
    setDragOverItemId(null);

    const item = items.find((i) => i.id === draggingId);
    if (!item) return;

    const newState = stateForColumn(targetColId);
    const newMeta =
      targetColId === "focus" || targetColId === "done" || targetColId === "planned"
        ? { ...item.metadata, session_col: undefined }
        : { ...item.metadata, session_col: targetColId };
    const completed_at =
      newState === "done" && item.state !== "done" ? new Date().toISOString() : item.completed_at;

    setItems((prev) =>
      prev.map((i) =>
        i.id === draggingId
          ? { ...i, state: newState, metadata: newMeta, completed_at: completed_at ?? null }
          : i
      )
    );
    void updateItem(draggingId, { state: newState, metadata: newMeta, completed_at });

    // Update session progress if moved to/from done
    const wasDone = item.state === "done";
    const isDoneNow = newState === "done";
    if (wasDone !== isDoneNow) {
      const delta = isDoneNow ? 1 : -1;
      const newCompleted = Math.max(0, session.completed_units + delta);
      void updateSession(session.id, { completed_units: newCompleted });
      onSessionUpdated({ ...session, completed_units: newCompleted });
    }
  }

  function handleHourDragOver(e: React.DragEvent, hour: number) {
    e.preventDefault();
    setDragOverHour(hour);
  }

  function handleHourDrop(e: React.DragEvent, hourStart: number) {
    e.preventDefault();
    setDragOverHour(null);
    if (!draggingId) return;
    const h = Math.floor(hourStart);
    const m = hourStart % 1 >= 0.5 ? 30 : 0;
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    setItems((prev) => prev.map((i) => (i.id === draggingId ? { ...i, scheduled_time: time } : i)));
    void updateItem(draggingId, { scheduled_time: time });
    setDraggingId(null);
  }

  // ── Item actions ─────────────────────────────────────────────────────────

  async function handleComplete(item: ItemData) {
    const isDone = item.state === "done";
    const newState = isDone ? "planned" : "done";
    const completed_at = isDone ? null : new Date().toISOString();
    const delta = isDone ? -1 : 1;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, state: newState, completed_at: completed_at ?? null } : i
      )
    );
    void updateItem(item.id, { state: newState, completed_at });
    const newCompleted = Math.max(0, session.completed_units + delta);
    void updateSession(session.id, { completed_units: newCompleted });
    onSessionUpdated({ ...session, completed_units: newCompleted });
  }

  async function handlePromote(item: ItemData) {
    setPromotingItemId(item.id);
  }

  async function confirmPromote(entityId: string | null) {
    if (!promotingItemId) return;
    await promoteToRealTask(promotingItemId, entityId);
    setItems((prev) =>
      prev.map((i) =>
        i.id === promotingItemId ? { ...i, session_origin: null, entity_id: entityId } : i
      )
    );
    setPromotingItemId(null);
  }

  // ── Column management ─────────────────────────────────────────────────────

  async function handleAddColumn() {
    const label = newColLabel.trim();
    if (!label) {
      setAddingColumn(false);
      return;
    }
    const newCol: SessionColumn = { id: crypto.randomUUID(), label };
    const newColumns = [...session.columns, newCol];
    await updateSessionColumns(session.id, newColumns);
    onSessionUpdated({ ...session, columns: newColumns });
    setNewColLabel("");
    setAddingColumn(false);
  }

  async function handleRemoveColumn(colId: string) {
    const catchall = allColumns.find((c) => c.is_catchall);
    if (catchall) {
      // Move items from removed column to catchall
      const toMove = items.filter((i) => i.metadata?.session_col === colId);
      await Promise.all(
        toMove.map((i) => updateItem(i.id, { metadata: { ...i.metadata, session_col: undefined } }))
      );
      setItems((prev) =>
        prev.map((i) =>
          i.metadata?.session_col === colId
            ? { ...i, metadata: { ...i.metadata, session_col: undefined } }
            : i
        )
      );
    }
    const newColumns = session.columns.filter((c) => c.id !== colId);
    await updateSessionColumns(session.id, newColumns);
    onSessionUpdated({ ...session, columns: newColumns });
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = scheduleWidth;
    setIsResizing(true);
    function onMove(ev: MouseEvent) {
      setScheduleWidth(Math.max(160, Math.min(480, startW + startX - ev.clientX)));
    }
    function onUp() {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">Loading session…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Kanban area ──────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Column scroll area */}
        <div className="flex flex-1 gap-3 overflow-x-auto overflow-y-hidden p-4">
          {allColumns.map((col) => (
            <KanbanColumn
              key={col.id}
              colId={col.id}
              label={col.label}
              items={itemsForColumn(col.id)}
              entities={entities}
              workspaceId={workspaceId}
              sessionId={session.id}
              isFixed={col.fixed}
              draggingId={draggingId}
              dragOverItemId={dragOverItemId}
              dragOverColId={dragOverColId}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOverItem={handleDragOverItem}
              onDragOverCol={handleDragOverCol}
              onDropCol={handleDropToColumn}
              onComplete={handleComplete}
              onSelect={(item) => onSelectItem(item.id)}
              onPromote={handlePromote}
              onTaskAdded={(item) => setItems((prev) => [...prev, item])}
              onRemove={!col.fixed ? () => void handleRemoveColumn(col.id) : undefined}
            />
          ))}

          {/* Add column */}
          {addingColumn ? (
            <div className="flex w-48 flex-none flex-col gap-1 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
              <input
                ref={colInputRef}
                value={newColLabel}
                onChange={(e) => setNewColLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddColumn();
                  if (e.key === "Escape") {
                    setAddingColumn(false);
                    setNewColLabel("");
                  }
                }}
                placeholder="Column name…"
                className="bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => void handleAddColumn()}
                  className="rounded px-2 py-0.5 text-[11px] font-medium text-brand-500 hover:bg-brand-500/10"
                >
                  Add
                </button>
                <button
                  onClick={() => setAddingColumn(false)}
                  className="rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="flex h-10 w-10 flex-none items-center justify-center self-start rounded-xl border border-dashed border-border text-muted-foreground/40 transition-colors hover:border-brand-400/50 hover:text-brand-500"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Resize handle ────────────────────────────────────────────────── */}
      {scheduleOpen && (
        <div
          className={cn(
            "w-1 flex-none cursor-col-resize bg-transparent transition-colors hover:bg-brand-500/40",
            isResizing && "bg-brand-500/40"
          )}
          onMouseDown={handleResizeStart}
        />
      )}

      {/* ── Schedule panel ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col border-l border-border",
          !isResizing && "transition-all duration-300"
        )}
        style={
          scheduleOpen ? { width: scheduleWidth, flexShrink: 0 } : { width: 32, flexShrink: 0 }
        }
      >
        {scheduleOpen ? (
          <>
            <div className="flex h-9 flex-none items-center justify-between border-b border-border px-3">
              <span className="text-xs font-semibold text-muted-foreground">Schedule</span>
              <button
                onClick={() => setScheduleOpen(false)}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight size={13} />
              </button>
            </div>
            <div ref={scheduleScrollRef} className="flex-1 overflow-y-auto py-2">
              <div className="relative" style={{ height: HOURS.length * PX_PER_HOUR + 16 }}>
                {HOURS.map((h, i) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0"
                    style={{ top: i * PX_PER_HOUR + 8, height: PX_PER_HOUR }}
                  >
                    {/* On-the-hour */}
                    <div
                      className="absolute inset-x-0 top-0 transition-colors"
                      style={{ height: PX_PER_HOUR / 2 }}
                      onDragOver={(e) => handleHourDragOver(e, h)}
                      onDrop={(e) => handleHourDrop(e, h)}
                    >
                      {dragOverHour === h && draggingId && (
                        <div className="absolute inset-0 bg-brand-500/10" />
                      )}
                      <div className="flex items-center">
                        <span className="w-12 flex-none pr-2 text-right text-[10px] tabular-nums text-muted-foreground/50">
                          {h % 12 === 0 ? 12 : h % 12}
                          <span className="text-[8px]">{h < 12 ? "am" : "pm"}</span>
                        </span>
                        <div
                          className={cn(
                            "h-px flex-1 transition-colors",
                            dragOverHour === h && draggingId ? "bg-brand-400/60" : "bg-border/60"
                          )}
                        />
                      </div>
                    </div>
                    {/* Half-hour */}
                    <div
                      className="absolute inset-x-0 bottom-0 transition-colors"
                      style={{ height: PX_PER_HOUR / 2 }}
                      onDragOver={(e) => handleHourDragOver(e, h + 0.5)}
                      onDrop={(e) => handleHourDrop(e, h + 0.5)}
                    >
                      {dragOverHour === h + 0.5 && draggingId && (
                        <div className="absolute inset-0 bg-brand-500/10" />
                      )}
                      <div className="flex items-center">
                        <span className="w-12 flex-none pr-2 text-right text-[9px] tabular-nums text-muted-foreground/25">
                          :30
                        </span>
                        <div
                          className={cn(
                            "h-px w-5 transition-colors",
                            dragOverHour === h + 0.5 && draggingId
                              ? "bg-brand-400/60"
                              : "bg-border/30"
                          )}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Scheduled items */}
                {scheduledItems.map((item) => {
                  const top = timeToTop(item.scheduled_time!) + 8;
                  const height = item.duration_estimate
                    ? Math.max((item.duration_estimate / 60) * PX_PER_HOUR, 24)
                    : 24;
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onSelectItem(item.id)}
                      className={cn(
                        "absolute cursor-pointer overflow-hidden rounded-lg border border-brand-500/20 bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-600 transition-all hover:bg-brand-500/20 dark:text-brand-400",
                        draggingId === item.id && "opacity-30"
                      )}
                      style={{
                        top,
                        height,
                        left: "52px",
                        right: "4px",
                      }}
                    >
                      <span className="line-clamp-2 leading-tight">{item.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <button
            onClick={() => setScheduleOpen(true)}
            className="flex h-full w-full flex-col items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft size={13} />
          </button>
        )}
      </div>

      {/* ── Promote modal ────────────────────────────────────────────────── */}
      {promotingItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPromotingItemId(null)} />
          <div className="relative w-full max-w-xs rounded-2xl border border-border bg-background p-5 shadow-2xl">
            <h3 className="mb-3 text-sm font-semibold">Promote to real task</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Assign to an entity or leave unassigned.
            </p>
            <div className="space-y-1">
              <button
                onClick={() => void confirmPromote(null)}
                className="flex w-full rounded-lg px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted"
              >
                No entity
              </button>
              {entities.map((e) => (
                <button
                  key={e.id}
                  onClick={() => void confirmPromote(e.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted"
                >
                  <span
                    className="h-2 w-2 flex-none rounded-full"
                    style={{ backgroundColor: e.color }}
                  />
                  {e.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPromotingItemId(null)}
              className="mt-3 w-full rounded-lg border border-border py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
