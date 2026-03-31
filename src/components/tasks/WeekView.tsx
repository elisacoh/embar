"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Undo2, ArrowRight, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeItem } from "@/lib/normalize";
import { updateItem } from "@/app/actions/items";
import { cn } from "@/lib/utils";
import type { EntityData, ItemData } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TODAY_STR = toLocalDateStr(new Date());

function getWeekDates(anchor: Date): Date[] {
  const day = anchor.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date): string {
  return toLocalDateStr(d);
}

function formatWeekLabel(dates: Date[]): string {
  const first = dates[0]!;
  const last = dates[6]!;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (first.getMonth() === last.getMonth()) {
    return `${first.toLocaleDateString("en-US", opts)} – ${last.getDate()}`;
  }
  return `${first.toLocaleDateString("en-US", opts)} – ${last.toLocaleDateString("en-US", opts)}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hr = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  const suffix = (h ?? 0) < 12 ? "am" : "pm";
  return m ? `${hr}:${String(m).padStart(2, "0")}${suffix}` : `${hr}${suffix}`;
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}

// ── Week card ────────────────────────────────────────────────────────────────

interface WeekCardProps {
  item: ItemData;
  entity: EntityData | null;
  isDragging: boolean;
  isSelected: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onSelect: () => void;
  onLater: () => void;
}

function WeekCard({
  item,
  entity,
  isDragging,
  isSelected,
  onDragStart,
  onDragEnd,
  onSelect,
  onLater,
}: WeekCardProps) {
  const hasMeta = item.scheduled_time || item.duration_estimate != null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        "group mb-1 cursor-pointer select-none rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm transition-all",
        "hover:border-border/80 hover:shadow-md",
        item.state === "focus" && "border-brand-500/40 bg-brand-500/5",
        isSelected && "border-brand-500/40 ring-1 ring-brand-500",
        isDragging && "opacity-30 shadow-none",
        item.state === "done" && "opacity-50"
      )}
    >
      <div className="flex items-start gap-1.5">
        {entity && (
          <span
            className="mt-[3px] h-1.5 w-1.5 flex-none rounded-full"
            style={{ backgroundColor: entity.color }}
          />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[11px] font-medium leading-snug",
            item.state === "done" && "text-muted-foreground line-through"
          )}
        >
          {item.title}
        </span>
      </div>

      {hasMeta && (
        <div className="mt-1 flex items-center gap-1.5 pl-3">
          {item.scheduled_time && (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {formatTime(item.scheduled_time)}
            </span>
          )}
          {item.duration_estimate != null && (
            <span className="text-[10px] text-muted-foreground/50">
              {formatDuration(item.duration_estimate)}
            </span>
          )}
        </div>
      )}

      {/* Hover Later button */}
      <div className="mt-0.5 flex opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLater();
          }}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowRight size={9} />
          Later
        </button>
      </div>
    </div>
  );
}

// ── Unplanned panel row ───────────────────────────────────────────────────────

interface UnplannedPanelRowProps {
  item: ItemData;
  entity: EntityData | null;
  isDragging: boolean;
  isSelected: boolean;
  weekDates: Date[];
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onSelect: () => void;
  onSchedule: (dateStr: string) => void;
}

function UnplannedPanelRow({
  item,
  entity,
  isDragging,
  isSelected,
  weekDates,
  onDragStart,
  onDragEnd,
  onSelect,
  onSchedule,
}: UnplannedPanelRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  return (
    <div className="relative">
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onSelect}
        className={cn(
          "group flex cursor-grab items-center gap-2 px-3 py-1.5 transition-colors hover:bg-muted/40",
          isSelected && "bg-brand-500/5",
          isDragging && "opacity-30"
        )}
      >
        {entity ? (
          <span
            className="h-1.5 w-1.5 flex-none rounded-full"
            style={{ backgroundColor: entity.color }}
          />
        ) : (
          <span className="h-1.5 w-1.5 flex-none rounded-full bg-muted-foreground/30" />
        )}
        <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{item.title}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen((v) => !v);
          }}
          className={cn(
            "flex-none rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
            pickerOpen
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"
          )}
        >
          <CalendarDays size={10} />
        </button>
      </div>

      {/* Day picker popover */}
      {pickerOpen && (
        <div
          ref={pickerRef}
          className="absolute right-2 top-full z-20 mt-1 rounded-xl border border-border bg-background p-2 shadow-xl"
        >
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Schedule for
          </p>
          <div className="flex flex-col gap-0.5">
            {weekDates.map((d) => {
              const ds = toDateStr(d);
              const isToday = ds === TODAY_STR;
              const isPast = ds < TODAY_STR;
              return (
                <button
                  key={ds}
                  onClick={() => {
                    onSchedule(ds);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] transition-colors",
                    isPast
                      ? "cursor-not-allowed text-muted-foreground/40"
                      : "text-foreground hover:bg-muted",
                    isToday && "font-semibold text-brand-600 dark:text-brand-400"
                  )}
                  disabled={isPast}
                >
                  <span
                    className={cn(
                      "h-5 w-5 flex-none rounded-full text-center text-[10px] leading-5",
                      isToday
                        ? "bg-brand-500 font-bold text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                  {isToday && <span className="ml-auto text-[9px] text-brand-500">Today</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface WeekViewProps {
  workspaceId: string;
  entityId: string | null;
  entities: EntityData[];
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
}

interface UndoState {
  itemId: string;
  prevDate: string | null;
  prevState: string;
  dayLabel: string;
  timerId: ReturnType<typeof setTimeout>;
}

export function WeekView({
  workspaceId,
  entityId,
  entities,
  onSelectItem,
  selectedItemId,
}: WeekViewProps) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [items, setItems] = useState<ItemData[]>([]);
  const [unplannedItems, setUnplannedItems] = useState<ItemData[]>([]);
  const [unplannedOpen, setUnplannedOpen] = useState(false);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);

  const weekDates = getWeekDates(anchor);
  const weekStart = toDateStr(weekDates[0]!);
  const weekEnd = toDateStr(weekDates[6]!);

  const isCurrentWeek = TODAY_STR >= weekStart && TODAY_STR <= weekEnd;

  // Auto-close panel when no unplanned items remain
  useEffect(() => {
    if (unplannedItems.length === 0) setUnplannedOpen(false);
  }, [unplannedItems.length]);

  // ── Data: week items ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();

    let q = supabase
      .from("items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("scheduled_date", weekStart)
      .lte("scheduled_date", weekEnd)
      .is("deleted_at", null);

    if (entityId) q = q.eq("entity_id", entityId);

    q.then(({ data }) =>
      setItems((data ?? []).map((r) => normalizeItem(r as Record<string, unknown>)))
    );

    const channel = supabase
      .channel(`week:${workspaceId}:${weekStart}`)
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
          setItems((prev) => {
            const inWeek =
              !!updated.scheduled_date &&
              updated.scheduled_date >= weekStart &&
              updated.scheduled_date <= weekEnd;
            const exists = prev.some((i) => i.id === updated.id);
            if (!inWeek) return prev.filter((i) => i.id !== updated.id);
            return exists
              ? prev.map((i) => (i.id === updated.id ? updated : i))
              : [...prev, updated];
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
  }, [workspaceId, entityId, weekStart, weekEnd]);

  // ── Data: unplanned items ────────────────────────────────────────────────

  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();

    let q = supabase
      .from("items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("state", "unplanned")
      .is("deleted_at", null);

    if (entityId) q = q.eq("entity_id", entityId);

    q.then(({ data }) =>
      setUnplannedItems((data ?? []).map((r) => normalizeItem(r as Record<string, unknown>)))
    );

    const channel = supabase
      .channel(`week-unplanned:${workspaceId}:${entityId ?? "all"}`)
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
          if (item.state !== "unplanned") return;
          setUnplannedItems((prev) =>
            prev.find((i) => i.id === item.id) ? prev : [...prev, item]
          );
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
          if (entityId && updated.entity_id !== entityId) return;
          setUnplannedItems((prev) => {
            if (updated.state === "unplanned") {
              const exists = prev.some((i) => i.id === updated.id);
              return exists
                ? prev.map((i) => (i.id === updated.id ? updated : i))
                : [...prev, updated];
            }
            return prev.filter((i) => i.id !== updated.id);
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
        (payload) => setUnplannedItems((prev) => prev.filter((i) => i.id !== payload.old.id))
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, entityId]);

  // ── Navigation ────────────────────────────────────────────────────────────

  function shiftWeek(delta: number) {
    setAnchor((a) => {
      const d = new Date(a);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, item: ItemData) {
    setDragItemId(item.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDragItemId(null);
    setDragOverDate(null);
  }

  function handleColumnDragOver(e: React.DragEvent, dateStr: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== dateStr) setDragOverDate(dateStr);
  }

  function handleColumnDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDate(null);
  }

  function handleColumnDrop(e: React.DragEvent, dateStr: string) {
    e.preventDefault();
    const id = dragItemId;
    setDragItemId(null);
    setDragOverDate(null);
    if (!id) return;

    // Find in week items or unplanned items
    const fromUnplanned = !items.some((i) => i.id === id);
    const item = items.find((i) => i.id === id) ?? unplannedItems.find((i) => i.id === id);
    if (!item) return;
    if (!fromUnplanned && item.scheduled_date === dateStr) return;

    const prevDate = item.scheduled_date;
    const prevState = item.state;
    const dayLabel = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
    });

    const isPast = dateStr < TODAY_STR;
    const stateUpdate =
      isPast && item.state !== "done" && item.state !== "someday"
        ? "carry-on"
        : !isPast && (item.state === "carry-on" || item.state === "unplanned")
          ? "planned"
          : fromUnplanned
            ? "planned"
            : item.state;

    const updates = { scheduled_date: dateStr, state: stateUpdate };

    // Optimistic update: remove from unplanned, add/update in week items
    if (fromUnplanned) {
      setUnplannedItems((prev) => prev.filter((i) => i.id !== id));
      setItems((prev) => [...prev, { ...item, ...updates }]);
    } else {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    }
    void updateItem(id, updates);

    // Undo only for within-week moves (not from unplanned panel)
    if (!fromUnplanned) {
      if (undo) clearTimeout(undo.timerId);
      const timerId = setTimeout(() => setUndo(null), 5000);
      setUndo({ itemId: id, prevDate, prevState, dayLabel, timerId });
    }
  }

  function handleUndo() {
    if (!undo) return;
    clearTimeout(undo.timerId);
    const { itemId, prevDate, prevState } = undo;
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, scheduled_date: prevDate, state: prevState } : i))
    );
    void updateItem(itemId, { scheduled_date: prevDate, state: prevState });
    setUndo(null);
  }

  // ── Move to Later (unplanned) ─────────────────────────────────────────────

  function handleMoveToLater(item: ItemData) {
    const updates = { state: "unplanned" as const, scheduled_date: null, scheduled_time: null };
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setUnplannedItems((prev) =>
      prev.find((i) => i.id === item.id) ? prev : [{ ...item, ...updates }, ...prev]
    );
    void updateItem(item.id, updates);
  }

  // Schedule from unplanned panel (day picker)
  function handleScheduleFromPanel(item: ItemData, dateStr: string) {
    const isPast = dateStr < TODAY_STR;
    const newState = isPast ? "carry-on" : "planned";
    const updates = { state: newState as ItemData["state"], scheduled_date: dateStr };
    setUnplannedItems((prev) => prev.filter((i) => i.id !== item.id));
    setItems((prev) => [...prev, { ...item, ...updates }]);
    void updateItem(item.id, updates);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const hasUnplanned = unplannedItems.length > 0;

  return (
    <>
      <div className="flex h-full overflow-hidden">
        {/* ── Week grid ─────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Navigation bar */}
          <div className="flex h-10 flex-none items-center justify-between border-b border-border px-4">
            <button
              onClick={() => shiftWeek(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft size={15} />
            </button>

            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-foreground">
                {formatWeekLabel(weekDates)}
              </span>
              {!isCurrentWeek && (
                <button
                  onClick={() => setAnchor(new Date())}
                  className="rounded-md border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  Today
                </button>
              )}
            </div>

            <button
              onClick={() => shiftWeek(1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* 7-column grid */}
          <div className="grid min-h-0 flex-1 grid-cols-7 divide-x divide-border overflow-hidden">
            {weekDates.map((date) => {
              const dateStr = toDateStr(date);
              const isToday = dateStr === TODAY_STR;
              const dayItems = items
                .filter((i) => i.scheduled_date === dateStr)
                .sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? ""));
              const isOver = dragOverDate === dateStr && !!dragItemId;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "flex flex-col transition-colors",
                    isToday && "bg-brand-500/[0.03]",
                    isOver && "bg-brand-500/10"
                  )}
                  onDragOver={(e) => handleColumnDragOver(e, dateStr)}
                  onDragLeave={handleColumnDragLeave}
                  onDrop={(e) => handleColumnDrop(e, dateStr)}
                >
                  {/* Column header */}
                  <div
                    className={cn(
                      "flex flex-none flex-col items-center border-b py-2",
                      isToday ? "border-brand-500/20" : "border-border"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        isToday ? "text-brand-500" : "text-muted-foreground"
                      )}
                    >
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                        isToday ? "bg-brand-500 text-white" : "text-foreground"
                      )}
                    >
                      {date.getDate()}
                    </span>
                    <span className="mt-0.5 h-3 text-[9px] text-muted-foreground/50">
                      {dayItems.length > 0 ? dayItems.length : ""}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                    {dayItems.map((item) => {
                      const entity = entities.find((e) => e.id === item.entity_id) ?? null;
                      return (
                        <WeekCard
                          key={item.id}
                          item={item}
                          entity={entity}
                          isDragging={dragItemId === item.id}
                          isSelected={selectedItemId === item.id}
                          onDragStart={(e) => handleDragStart(e, item)}
                          onDragEnd={handleDragEnd}
                          onSelect={() => onSelectItem(item.id)}
                          onLater={() => handleMoveToLater(item)}
                        />
                      );
                    })}
                    {isOver && dayItems.length === 0 && (
                      <div className="flex h-10 items-center justify-center rounded-lg border border-dashed border-brand-400/60 text-[10px] text-brand-500">
                        Drop here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Unplanned panel ───────────────────────────────────────────── */}
        <div
          className={cn(
            "flex flex-none flex-col border-l border-border transition-all duration-300",
            unplannedOpen ? "w-52" : "w-8"
          )}
        >
          {unplannedOpen ? (
            <>
              {/* Panel header */}
              <div className="flex h-10 flex-none items-center justify-between border-b border-border px-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Later</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {unplannedItems.length}
                  </span>
                </div>
                <button
                  onClick={() => setUnplannedOpen(false)}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Collapse"
                >
                  <ChevronRight size={13} />
                </button>
              </div>

              {/* Hint */}
              <p className="px-3 pb-1 pt-2 text-[10px] text-muted-foreground/60">
                Drag to a day or pick a date to schedule
              </p>

              {/* List */}
              <div className="min-h-0 flex-1 overflow-y-auto pb-4">
                {unplannedItems.map((item) => {
                  const entity = entities.find((e) => e.id === item.entity_id) ?? null;
                  return (
                    <UnplannedPanelRow
                      key={item.id}
                      item={item}
                      entity={entity}
                      isDragging={dragItemId === item.id}
                      isSelected={selectedItemId === item.id}
                      weekDates={weekDates}
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      onSelect={() => onSelectItem(item.id)}
                      onSchedule={(dateStr) => handleScheduleFromPanel(item, dateStr)}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            /* Collapsed tab */
            <button
              onClick={() => hasUnplanned && setUnplannedOpen(true)}
              disabled={!hasUnplanned}
              title={
                hasUnplanned
                  ? `${unplannedItems.length} unplanned task${unplannedItems.length !== 1 ? "s" : ""}`
                  : "No unplanned tasks"
              }
              className={cn(
                "flex h-full w-full flex-col items-center justify-center gap-2 transition-colors",
                hasUnplanned
                  ? "cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "cursor-not-allowed text-muted-foreground/30"
              )}
            >
              <ChevronLeft size={13} />
              {hasUnplanned && (
                <span className="rotate-180 text-[10px] font-semibold [writing-mode:vertical-rl]">
                  Later ({unplannedItems.length})
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Undo toast */}
      {undo && (
        <div className="animate-in fade-in slide-in-from-bottom-2 fixed bottom-20 left-1/2 z-50 -translate-x-1/2 duration-200">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-2.5 shadow-xl">
            <span className="text-xs text-foreground">
              Task moved to <span className="font-semibold">{undo.dayLabel}</span>.
            </span>
            <button
              onClick={handleUndo}
              className="flex items-center gap-1.5 rounded-md bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-500/20 dark:text-brand-400"
            >
              <Undo2 size={11} />
              Undo
            </button>
          </div>
        </div>
      )}
    </>
  );
}
