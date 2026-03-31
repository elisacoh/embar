"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowRight, CalendarDays } from "lucide-react";
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
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface GridDay {
  date: Date;
  isCurrentMonth: boolean;
}

function getMonthGrid(anchor: Date): GridDay[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDow = firstDay.getDay();
  const startOffset = startDow === 0 ? -6 : 1 - startDow; // shift to Monday

  const endDow = lastDay.getDay();
  const endOffset = endDow === 0 ? 0 : 7 - endDow; // pad to Sunday

  const result: GridDay[] = [];
  let cur = new Date(year, month, 1 + startOffset);
  const end = new Date(year, month, lastDay.getDate() + endOffset);

  while (cur <= end) {
    result.push({ date: new Date(cur), isCurrentMonth: cur.getMonth() === month });
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return result;
}

function formatMonthYear(anchor: Date): string {
  return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Month chip ───────────────────────────────────────────────────────────────

interface MonthChipProps {
  item: ItemData;
  entity: EntityData | null;
  isDragging: boolean;
  isSelected: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onSelect: () => void;
  onLater: () => void;
}

function MonthChip({
  item,
  entity,
  isDragging,
  isSelected,
  onDragStart,
  onDragEnd,
  onSelect,
  onLater,
}: MonthChipProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        "group mb-px flex cursor-pointer select-none items-center gap-1 rounded px-1 py-[2px] text-[10px] transition-all",
        "hover:bg-muted/80",
        item.state === "focus" && "bg-brand-500/10",
        item.state === "carry-on" && "bg-red-500/5",
        item.state === "done" && "opacity-40",
        isSelected && "ring-1 ring-inset ring-brand-500/60",
        isDragging && "opacity-30"
      )}
    >
      {entity && (
        <span
          className="h-1.5 w-1.5 flex-none rounded-full"
          style={{ backgroundColor: entity.color }}
        />
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate leading-tight",
          item.state === "done" && "text-muted-foreground line-through",
          item.state === "focus" && "font-medium text-brand-600 dark:text-brand-400"
        )}
      >
        {item.title}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onLater();
        }}
        className="hidden flex-none text-muted-foreground transition-colors hover:text-foreground group-hover:flex"
      >
        <ArrowRight size={9} />
      </button>
    </div>
  );
}

// ── Unplanned panel row ───────────────────────────────────────────────────────

interface UnplannedPanelRowProps {
  item: ItemData;
  entity: EntityData | null;
  isDragging: boolean;
  isSelected: boolean;
  grid: GridDay[];
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
  grid,
  onDragStart,
  onDragEnd,
  onSelect,
  onSchedule,
}: UnplannedPanelRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

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

  // Show only current-month days + today and future
  const futureDays = grid
    .filter((d) => d.isCurrentMonth && toLocalDateStr(d.date) >= TODAY_STR)
    .slice(0, 14);

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

      {pickerOpen && (
        <div
          ref={pickerRef}
          className="absolute right-2 top-full z-20 mt-1 max-h-48 w-44 overflow-y-auto rounded-xl border border-border bg-background p-2 shadow-xl"
        >
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Schedule for
          </p>
          {futureDays.length === 0 ? (
            <p className="px-1 text-[10px] text-muted-foreground/60">No upcoming days this month</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {futureDays.map(({ date }) => {
                const ds = toLocalDateStr(date);
                const isToday = ds === TODAY_STR;
                return (
                  <button
                    key={ds}
                    onClick={() => {
                      onSchedule(ds);
                      setPickerOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-muted",
                      isToday && "font-semibold text-brand-600 dark:text-brand-400"
                    )}
                  >
                    <span
                      className={cn(
                        "h-5 w-5 flex-none rounded-full text-center text-[10px] leading-5",
                        isToday
                          ? "bg-brand-500 font-bold text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {date.toLocaleDateString("en-US", { weekday: "short" })}
                    {isToday && <span className="ml-auto text-[9px] text-brand-500">Today</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface MonthViewProps {
  workspaceId: string;
  entityId: string | null;
  entities: EntityData[];
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
}

export function MonthView({
  workspaceId,
  entityId,
  entities,
  onSelectItem,
  selectedItemId,
}: MonthViewProps) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [items, setItems] = useState<ItemData[]>([]);
  const [unplannedItems, setUnplannedItems] = useState<ItemData[]>([]);
  const [unplannedOpen, setUnplannedOpen] = useState(false);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const grid = getMonthGrid(anchor);
  const gridStart = toLocalDateStr(grid[0]!.date);
  const gridEnd = toLocalDateStr(grid[grid.length - 1]!.date);

  const isCurrentMonth = (() => {
    const now = new Date();
    return anchor.getFullYear() === now.getFullYear() && anchor.getMonth() === now.getMonth();
  })();

  // Auto-close panel when no unplanned items
  useEffect(() => {
    if (unplannedItems.length === 0) setUnplannedOpen(false);
  }, [unplannedItems.length]);

  // ── Data: month items ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();

    let q = supabase
      .from("items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("scheduled_date", gridStart)
      .lte("scheduled_date", gridEnd)
      .is("deleted_at", null);

    if (entityId) q = q.eq("entity_id", entityId);

    q.then(({ data }) =>
      setItems((data ?? []).map((r) => normalizeItem(r as Record<string, unknown>)))
    );

    const channel = supabase
      .channel(`month:${workspaceId}:${gridStart}`)
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
            const inRange =
              !!updated.scheduled_date &&
              updated.scheduled_date >= gridStart &&
              updated.scheduled_date <= gridEnd;
            const exists = prev.some((i) => i.id === updated.id);
            if (!inRange) return prev.filter((i) => i.id !== updated.id);
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
  }, [workspaceId, entityId, gridStart, gridEnd]);

  // ── Data: unplanned items ──────────────────────────────────────────────────

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
      .channel(`month-unplanned:${workspaceId}:${entityId ?? "all"}`)
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

  // ── Navigation ─────────────────────────────────────────────────────────────

  function shiftMonth(delta: number) {
    setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + delta, 1));
  }

  // ── Drag ───────────────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, item: ItemData) {
    setDragItemId(item.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDragItemId(null);
    setDragOverDate(null);
  }

  function handleCellDragOver(e: React.DragEvent, dateStr: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== dateStr) setDragOverDate(dateStr);
  }

  function handleCellDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDate(null);
  }

  function handleCellDrop(e: React.DragEvent, dateStr: string) {
    e.preventDefault();
    const id = dragItemId;
    setDragItemId(null);
    setDragOverDate(null);
    if (!id) return;

    const fromUnplanned = !items.some((i) => i.id === id);
    const item = items.find((i) => i.id === id) ?? unplannedItems.find((i) => i.id === id);
    if (!item) return;
    if (!fromUnplanned && item.scheduled_date === dateStr) return;

    const isPast = dateStr < TODAY_STR;
    const newState =
      isPast && item.state !== "done" && item.state !== "someday"
        ? "carry-on"
        : !isPast && (item.state === "carry-on" || item.state === "unplanned")
          ? "planned"
          : fromUnplanned
            ? "planned"
            : item.state;

    const updates = { scheduled_date: dateStr, state: newState };

    if (fromUnplanned) {
      setUnplannedItems((prev) => prev.filter((i) => i.id !== id));
      setItems((prev) => [...prev, { ...item, ...updates }]);
    } else {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    }
    void updateItem(id, updates);
  }

  // ── Later / Schedule from panel ────────────────────────────────────────────

  function handleMoveToLater(item: ItemData) {
    const updates = { state: "unplanned" as const, scheduled_date: null, scheduled_time: null };
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setUnplannedItems((prev) =>
      prev.find((i) => i.id === item.id) ? prev : [{ ...item, ...updates }, ...prev]
    );
    void updateItem(item.id, updates);
  }

  function handleScheduleFromPanel(item: ItemData, dateStr: string) {
    const isPast = dateStr < TODAY_STR;
    const newState = isPast ? "carry-on" : "planned";
    const updates = { state: newState as ItemData["state"], scheduled_date: dateStr };
    setUnplannedItems((prev) => prev.filter((i) => i.id !== item.id));
    setItems((prev) => [...prev, { ...item, ...updates }]);
    void updateItem(item.id, updates);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasUnplanned = unplannedItems.length > 0;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Month grid ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Navigation bar */}
        <div className="flex h-10 flex-none items-center justify-between border-b border-border px-4">
          <button
            onClick={() => shiftMonth(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft size={15} />
          </button>

          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-foreground">{formatMonthYear(anchor)}</span>
            {!isCurrentMonth && (
              <button
                onClick={() => setAnchor(new Date())}
                className="rounded-md border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Today
              </button>
            )}
          </div>

          <button
            onClick={() => shiftMonth(1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid flex-none grid-cols-7 divide-x divide-border border-b border-border">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-7 divide-x divide-border">
            {grid.map(({ date, isCurrentMonth: inMonth }) => {
              const dateStr = toLocalDateStr(date);
              const isToday = dateStr === TODAY_STR;
              const dayItems = items
                .filter((i) => i.scheduled_date === dateStr)
                .sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? ""));
              const isOver = dragOverDate === dateStr && !!dragItemId;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "min-h-[100px] border-b border-border p-1 transition-colors",
                    !inMonth && "bg-muted/20",
                    isToday && "bg-brand-500/[0.03]",
                    isOver && "bg-brand-500/10"
                  )}
                  onDragOver={(e) => handleCellDragOver(e, dateStr)}
                  onDragLeave={handleCellDragLeave}
                  onDrop={(e) => handleCellDrop(e, dateStr)}
                >
                  {/* Day number */}
                  <div className="mb-0.5 flex justify-end pr-0.5">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium tabular-nums",
                        isToday
                          ? "bg-brand-500 font-bold text-white"
                          : inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/30"
                      )}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  {/* Task chips */}
                  {dayItems.map((item) => {
                    const entity = entities.find((e) => e.id === item.entity_id) ?? null;
                    return (
                      <MonthChip
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
                    <div className="mt-1 flex items-center justify-center rounded border border-dashed border-brand-400/60 py-1.5 text-[9px] text-brand-500">
                      Drop
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

            <p className="px-3 pb-1 pt-2 text-[10px] text-muted-foreground/60">
              Drag to a day or pick a date to schedule
            </p>

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
                    grid={grid}
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
  );
}
