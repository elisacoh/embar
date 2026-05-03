"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pause,
  Play,
  CheckCircle2,
  Clock,
  ArrowRight,
  Play as PlayIcon,
  Calendar,
  Pencil,
  MoveRight,
  CalendarClock,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeItem } from "@/lib/normalize";
import { updateItem, deleteItem } from "@/app/actions/items";
import { cn } from "@/lib/utils";
import type { EntityData, ItemData } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TODAY = toLocalDateStr(new Date());
const TIMER_LS_KEY = "embar:focus-timer";

const SECTIONS = [
  { state: "focus", label: "Focus", dot: "bg-brand-500", color: "text-brand-500" },
  {
    state: "planned",
    label: "Planned",
    dot: "bg-blue-500",
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    state: "carry-on",
    label: "Carry-on",
    dot: "bg-red-500",
    color: "text-red-600 dark:text-red-400",
  },
  {
    state: "unplanned",
    label: "Later",
    dot: "bg-muted-foreground/40",
    color: "text-muted-foreground",
  },
  {
    state: "someday",
    label: "Someday",
    dot: "bg-purple-500",
    color: "text-purple-600 dark:text-purple-400",
  },
  {
    state: "done",
    label: "Done",
    dot: "bg-green-500",
    color: "text-green-600 dark:text-green-400",
  },
] as const;

type SectionState = (typeof SECTIONS)[number]["state"];

const SCHEDULE_START = 6;
const SCHEDULE_END = 21;
const HOURS = Array.from({ length: SCHEDULE_END - SCHEDULE_START }, (_, i) => i + SCHEDULE_START);
const PX_PER_HOUR = 60;

// ── Timer types ──────────────────────────────────────────────────────────────

interface TimerState {
  itemId: string;
  elapsed: number; // accumulated ms from paused runs
  startedAt: number | null; // Date.now() when current run started; null = paused
}

function loadTimer(): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_LS_KEY);
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
}

function saveTimer(t: TimerState | null) {
  try {
    if (t) localStorage.setItem(TIMER_LS_KEY, JSON.stringify(t));
    else localStorage.removeItem(TIMER_LS_KEY);
  } catch {
    /* ignore */
  }
}

function timerMs(t: TimerState): number {
  return t.elapsed + (t.startedAt ? Date.now() - t.startedAt : 0);
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hr = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  const suffix = (h ?? 0) < 12 ? "am" : "pm";
  return m ? `${hr}:${String(m).padStart(2, "0")} ${suffix}` : `${hr} ${suffix}`;
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(d: string): string {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDaysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Math.floor(
    (new Date(TODAY + "T00:00:00").getTime() - new Date(dateStr + "T00:00:00").getTime()) /
      86_400_000
  );
  return diff > 0 ? diff : null;
}

function overdueBadge(dateStr: string | null): string | null {
  const d = getDaysAgo(dateStr);
  if (!d) return null;
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

function timeToTop(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h ?? 0) - SCHEDULE_START) * PX_PER_HOUR + ((m ?? 0) / 60) * PX_PER_HOUR;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// Returns column assignment for overlapping scheduled items so they render side-by-side.
function computeScheduleLayout(items: ItemData[]): Map<string, { col: number; totalCols: number }> {
  if (items.length === 0) return new Map();

  const slots = items.map((item) => ({
    id: item.id,
    start: timeToMinutes(item.scheduled_time!),
    end: timeToMinutes(item.scheduled_time!) + Math.max(item.duration_estimate ?? 30, 30),
  }));

  // Greedy column assignment: put each item in the first column it doesn't conflict with
  const cols: number[] = new Array(slots.length).fill(-1);
  for (let i = 0; i < slots.length; i++) {
    const usedCols = new Set(
      slots.slice(0, i).flatMap((other, j) => {
        const overlaps = other.start < slots[i]!.end && other.end > slots[i]!.start;
        return overlaps ? [cols[j]!] : [];
      })
    );
    let c = 0;
    while (usedCols.has(c)) c++;
    cols[i] = c;
  }

  // For each item, totalCols = max column in its overlap group + 1
  const result = new Map<string, { col: number; totalCols: number }>();
  slots.forEach((slot, i) => {
    const groupCols = slots
      .map((other, j) => (other.start < slot.end && other.end > slot.start ? cols[j]! : -1))
      .filter((c) => c >= 0);
    result.set(slot.id, { col: cols[i]!, totalCols: Math.max(...groupCols) + 1 });
  });

  return result;
}

// ── Current-time indicator ───────────────────────────────────────────────────

function CurrentTimeLine() {
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    function calc() {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h < SCHEDULE_START || h >= SCHEDULE_END) {
        setTop(null);
        return;
      }
      setTop((h - SCHEDULE_START) * PX_PER_HOUR + (m / 60) * PX_PER_HOUR);
    }
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, []);

  if (top === null) return null;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
      style={{ top }}
    >
      <div className="ml-14 h-px flex-1 bg-red-500" />
      <div className="-ml-1 h-2 w-2 rounded-full bg-red-500" />
    </div>
  );
}

// ── Focus card ───────────────────────────────────────────────────────────────

interface FocusCardProps {
  item: ItemData;
  entity: EntityData | null;
  timer: TimerState | null;
  completing: boolean;
  isDragging: boolean;
  isSelected: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onPause: () => void;
  onResume: () => void;
  onLater: () => void;
  onDone: () => void;
  onToggleSubtask: (subtaskId: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function FocusCard({
  item,
  entity,
  timer,
  completing,
  isDragging,
  isSelected,
  onDragStart,
  onDragEnd,
  onSelect,
  onPause,
  onResume,
  onLater,
  onDone,
  onToggleSubtask,
  onContextMenu,
}: FocusCardProps) {
  const [, setTick] = useState(0);
  const hasExtra = !!(item.description || item.subtasks.length > 0);
  const [extraOpen, setExtraOpen] = useState(hasExtra);

  // Tick every second while running
  useEffect(() => {
    if (!timer?.startedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer?.startedAt]);

  const isRunning = !!timer?.startedAt;
  const elapsedMs = timer ? timerMs(timer) : 0;
  const targetMin = item.duration_estimate;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={cn(
        "mx-4 mb-3 w-[min(100%-2rem,480px)] cursor-pointer select-none overflow-hidden rounded-2xl border-2 shadow-lg transition-all",
        "border-brand-500/50 bg-gradient-to-br from-brand-500/10 via-brand-500/5 to-transparent",
        "shadow-brand-500/10 hover:shadow-brand-500/20",
        isSelected && "ring-2 ring-brand-500/60",
        isDragging && "opacity-30 shadow-none",
        completing && "scale-95 opacity-50"
      )}
    >
      {/* Top strip */}
      <div className="flex items-center gap-2 border-b border-brand-500/10 px-4 py-2">
        {entity ? (
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <span
              className="h-1.5 w-1.5 flex-none rounded-full"
              style={{ backgroundColor: entity.color }}
            />
            {entity.name}
          </span>
        ) : null}
        {item.due_date && (
          <span
            className={cn(
              "ml-auto flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              new Date(item.due_date) < new Date()
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-background/60 text-muted-foreground"
            )}
          >
            <Clock size={9} />
            {formatDate(item.due_date)}
          </span>
        )}
      </div>

      {/* Two-column body: left = title + timer, right = description + subtasks */}
      <div className="flex items-stretch px-4 pb-3 pt-3">
        {/* Left: title + big timer — always takes remaining space */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p
            className={cn(
              "text-sm font-semibold leading-snug text-foreground",
              completing && "text-muted-foreground line-through"
            )}
          >
            {item.title}
          </p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-mono text-2xl font-bold tabular-nums tracking-tight",
                isRunning ? "text-brand-500" : "text-muted-foreground"
              )}
            >
              {formatElapsed(elapsedMs)}
            </span>
            {targetMin != null && (
              <span className="text-xs text-muted-foreground">/ {formatDuration(targetMin)}</span>
            )}
          </div>
        </div>

        {/* Toggle strip — always visible, chevron points left to collapse, right to expand */}
        {hasExtra && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExtraOpen((v) => !v);
            }}
            className="flex flex-none items-center self-stretch px-1.5 text-muted-foreground/30 transition-colors hover:text-brand-500"
          >
            <ChevronLeft
              size={12}
              className={cn("transition-transform duration-200", !extraOpen && "rotate-180")}
            />
          </button>
        )}

        {/* Right: description + subtasks — slides open/closed horizontally */}
        {hasExtra && (
          <div
            className="overflow-hidden border-l border-brand-500/10 transition-[width] duration-200"
            style={{ width: extraOpen ? "48%" : 0, maxHeight: extraOpen ? undefined : 0 }}
          >
            <div className="space-y-1.5 pl-3">
              {item.description &&
                (() => {
                  const text = stripHtml(item.description);
                  return text ? (
                    <p className="whitespace-pre-line text-[11px] leading-relaxed text-muted-foreground">
                      {text}
                    </p>
                  ) : null;
                })()}
              {item.subtasks.length > 0 && (
                <div className="space-y-1">
                  {item.subtasks.map((s) => (
                    <button
                      key={s.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSubtask(s.id);
                      }}
                      className="group flex w-full items-center gap-1.5 text-left"
                    >
                      <div
                        className={cn(
                          "h-3 w-3 flex-none rounded-full border transition-all",
                          s.done
                            ? "border-green-500 bg-green-500/30"
                            : "border-brand-500/40 group-hover:border-brand-500"
                        )}
                      />
                      <span
                        className={cn(
                          "text-[11px] leading-snug",
                          s.done ? "text-muted-foreground/40 line-through" : "text-foreground/75"
                        )}
                      >
                        {s.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 border-t border-brand-500/10 px-4 py-2.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isRunning) onPause();
            else onResume();
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
            isRunning
              ? "border-brand-500/30 bg-brand-500/10 text-brand-600 hover:bg-brand-500/20 dark:text-brand-400"
              : "border-border bg-background/60 text-muted-foreground hover:bg-muted"
          )}
        >
          {isRunning ? <Pause size={11} /> : <Play size={11} />}
          {isRunning ? "Pause" : "Resume"}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onLater();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted"
        >
          <ArrowRight size={11} />
          Later
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDone();
          }}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-brand-600"
        >
          <CheckCircle2 size={11} />
          Done
        </button>
      </div>
    </div>
  );
}

// ── Planned card (grid layout) ────────────────────────────────────────────────

interface DragTargetProps {
  isDragTarget: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
}

interface PlannedCardProps extends DragTargetProps {
  item: ItemData;
  entity: EntityData | null;
  isDragging: boolean;
  isSelected: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onFocus: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function PlannedCard({
  item,
  entity,
  isDragging,
  isSelected,
  isDragTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onSelect,
  onFocus,
  onContextMenu,
}: PlannedCardProps) {
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const isCritical = item.urgency === "critical";
  const isUrgent = item.urgency === "urgent";
  const isOverdue = item.due_date ? new Date(item.due_date + "T23:59:59") < new Date() : false;
  const doneCount = item.subtasks.filter((s) => s.done).length;
  const hasAccent = isCritical || isUrgent;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={cn(
        "group relative w-44 cursor-pointer select-none overflow-hidden rounded-xl border bg-card transition-all",
        "hover:shadow-sm",
        isCritical
          ? "border-destructive/25 bg-destructive/[0.015]"
          : isUrgent
            ? "border-amber-500/25"
            : "border-border",
        isSelected && "ring-1 ring-brand-500",
        isDragging && "opacity-30"
      )}
    >
      {isDragTarget && <div className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-brand-500" />}

      {/* Urgency accent strip */}
      {hasAccent && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[3px]",
            isCritical ? "bg-destructive" : "bg-amber-400"
          )}
        />
      )}

      <div className={cn("flex flex-col gap-2 p-3", hasAccent && "pl-4")}>
        {/* Top row: entity dot + time | Focus on hover */}
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {entity && (
              <span
                className="h-1.5 w-1.5 flex-none rounded-full"
                style={{ backgroundColor: entity.color }}
              />
            )}
            {item.scheduled_time && (
              <span className="truncate text-[10px] tabular-nums text-muted-foreground/60">
                {formatTime(item.scheduled_time)}
              </span>
            )}
          </div>
          {/* Focus button — visible on hover, never overlaps body */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
            }}
            className="flex flex-none items-center gap-0.5 rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600 opacity-0 transition-opacity hover:bg-brand-500/20 group-hover:opacity-100 dark:text-brand-400"
          >
            <PlayIcon size={8} />
            Focus
          </button>
        </div>

        {/* Title */}
        <p className="line-clamp-3 text-sm font-medium leading-snug text-foreground">
          {item.title}
        </p>

        {/* Due date */}
        {item.due_date && (
          <p
            className={cn(
              "text-[10px] tabular-nums",
              isOverdue ? "font-semibold text-destructive" : "text-muted-foreground/45"
            )}
          >
            {isOverdue ? "⚠ " : ""}
            {formatDate(item.due_date)}
          </p>
        )}

        {/* Footer: subtasks toggle + duration */}
        <div className="flex items-center gap-1.5">
          {item.subtasks.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSubtasksOpen((o) => !o);
              }}
              className="flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
            >
              <ChevronDown
                size={9}
                className={cn("transition-transform", subtasksOpen && "rotate-180")}
              />
              {doneCount}/{item.subtasks.length}
            </button>
          )}
          {item.duration_estimate != null && (
            <span className="ml-auto text-[10px] text-muted-foreground/45">
              {formatDuration(item.duration_estimate)}
            </span>
          )}
        </div>

        {/* Subtask list */}
        {subtasksOpen && item.subtasks.length > 0 && (
          <div className="space-y-1.5 border-t border-border/40 pt-2">
            {item.subtasks.map((s) => (
              <div key={s.id} className="flex items-start gap-1.5">
                <div
                  className={cn(
                    "mt-0.5 h-3 w-3 flex-none rounded-full border",
                    s.done ? "border-green-500 bg-green-500/20" : "border-muted-foreground/30"
                  )}
                />
                <span
                  className={cn(
                    "text-[11px] leading-snug",
                    s.done ? "text-muted-foreground/40 line-through" : "text-foreground/75"
                  )}
                >
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Regular task card ────────────────────────────────────────────────────────

interface TaskCardProps extends DragTargetProps {
  item: ItemData;
  completing: boolean;
  isDragging: boolean;
  isSelected: boolean;
  overdueBadge?: string | null;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onCheckbox: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function TaskCard({
  item,
  completing,
  isDragging,
  isSelected,
  isDragTarget,
  overdueBadge: overdueLabel,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onCheckbox,
  onSelect,
  onContextMenu,
}: TaskCardProps) {
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const isCritical = item.urgency === "critical";
  const isUrgent = item.urgency === "urgent";
  const isOverdue = item.due_date ? new Date(item.due_date + "T23:59:59") < new Date() : false;
  const doneCount = item.subtasks.filter((s) => s.done).length;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={cn(
        "group relative mx-4 mb-1.5 w-[min(100%-2rem,480px)] cursor-pointer select-none overflow-hidden rounded-xl border bg-card transition-all",
        "hover:shadow-sm",
        isCritical
          ? "border-destructive/25 bg-destructive/[0.015]"
          : isUrgent
            ? "border-amber-500/25"
            : "border-border",
        item.state === "done" && "opacity-50",
        isSelected && "ring-1 ring-brand-500",
        isDragging && "opacity-30",
        completing && "opacity-40"
      )}
    >
      {isDragTarget && <div className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-brand-500" />}

      {/* Urgency accent strip */}
      {(isCritical || isUrgent) && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[3px]",
            isCritical ? "bg-destructive" : "bg-amber-400"
          )}
        />
      )}

      <div className={cn("flex items-start gap-2.5 p-2.5", (isCritical || isUrgent) && "pl-4")}>
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCheckbox();
          }}
          aria-label="Complete"
          className="mt-0.5 flex-none"
        >
          <div
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all duration-200",
              completing
                ? "border-green-500 bg-green-500 text-white"
                : isCritical
                  ? "border-destructive/40 hover:border-destructive"
                  : "border-muted-foreground/30 hover:border-brand-500"
            )}
          >
            {completing && (
              <svg viewBox="0 0 8 8" className="h-2 w-2" fill="none">
                <path
                  d="M1.5 4l2 2 3-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </button>

        <div className="min-w-0 flex-1">
          {/* Title + due date */}
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "text-sm leading-snug",
                completing || item.state === "done"
                  ? "text-muted-foreground line-through"
                  : "text-foreground"
              )}
            >
              {item.title}
            </p>
            {item.due_date && (
              <span
                className={cn(
                  "flex-none text-[10px] tabular-nums",
                  isOverdue || overdueLabel
                    ? "font-semibold text-destructive"
                    : "text-muted-foreground/50"
                )}
              >
                {formatDate(item.due_date)}
              </span>
            )}
          </div>

          {/* Subtasks toggle */}
          {item.subtasks.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSubtasksOpen((o) => !o);
              }}
              className="mt-1 flex items-center gap-0.5 text-[10px] text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            >
              <ChevronDown
                size={9}
                className={cn("transition-transform", subtasksOpen && "rotate-180")}
              />
              {doneCount}/{item.subtasks.length} subtasks
            </button>
          )}

          {subtasksOpen && (
            <div className="mt-1.5 space-y-1">
              {item.subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "h-3 w-3 flex-none rounded-full border",
                      s.done ? "border-green-500 bg-green-500/20" : "border-muted-foreground/30"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[11px]",
                      s.done ? "text-muted-foreground/50 line-through" : "text-foreground/80"
                    )}
                  >
                    {s.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Unplanned (Later) row ────────────────────────────────────────────────────

interface UnplannedRowProps extends DragTargetProps {
  item: ItemData;
  isSelected: boolean;
  isDragging: boolean;
  overdueBadge?: string | null;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onSchedule: (date: string, time: string | null) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function UnplannedRow({
  item,
  isSelected,
  isDragging,
  isDragTarget,
  overdueBadge: overdueLabel,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onSelect,
  onSchedule,
  onContextMenu,
}: UnplannedRowProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(TODAY);
  const [time, setTime] = useState("");

  function confirm() {
    onSchedule(date, time || null);
    setOpen(false);
  }

  return (
    <div>
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "group relative flex cursor-grab items-center gap-3 px-4 py-1.5 transition-colors hover:bg-muted/40",
          isSelected && "bg-brand-500/5",
          isDragging && "opacity-30"
        )}
        onClick={onSelect}
        onContextMenu={onContextMenu}
      >
        {isDragTarget && <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-500" />}
        <div
          className={cn(
            "h-1.5 w-1.5 flex-none rounded-full",
            overdueLabel ? "bg-red-500" : "bg-muted-foreground/30"
          )}
        />
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{item.title}</span>
        {overdueLabel && (
          <span className="flex-none rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
            {overdueLabel}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className={cn(
            "flex flex-none items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
            open
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"
          )}
        >
          <CalendarClock size={10} />
          Schedule
        </button>
      </div>

      {open && (
        <div className="mx-4 mb-2 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={date}
              min={TODAY}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={confirm}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface TodayViewProps {
  workspaceId: string;
  entityId: string | null;
  entities: EntityData[];
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
  onNewTask: () => void;
  pendingItem?: ItemData;
  viewDate?: Date;
}

export function TodayView({
  workspaceId,
  entityId,
  entities,
  onSelectItem,
  selectedItemId: _selectedItemId,
  onNewTask,
  pendingItem,
  viewDate: viewDateProp,
}: TodayViewProps) {
  const viewDate = viewDateProp ?? new Date();
  const viewDateStr = toLocalDateStr(viewDate);
  const isViewingToday = viewDateStr === TODAY;
  const [items, setItems] = useState<ItemData[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [scheduleWidth, setScheduleWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ item: ItemData; x: number; y: number } | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<ItemData | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Tracks where each item was before it entered focus — keyed by item ID
  const [prevFocusStates, setPrevFocusStates] = useState<Map<string, SectionState>>(new Map());

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorItemId, setAnchorItemId] = useState<string | null>(null);
  const [dragIds, setDragIds] = useState<Set<string>>(new Set());

  // Drag state
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<SectionState | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // Timer state (localStorage-backed)
  const [timer, setTimerState] = useState<TimerState | null>(null);
  const timerRef = useRef<TimerState | null>(null);

  const scheduleScrollRef = useRef<HTMLDivElement>(null);

  // ── Timer helpers ─────────────────────────────────────────────────────────

  const setTimer = useCallback(
    (t: TimerState | null | ((prev: TimerState | null) => TimerState | null)) => {
      setTimerState((prev) => {
        const next = typeof t === "function" ? t(prev) : t;
        timerRef.current = next;
        saveTimer(next);
        return next;
      });
    },
    []
  );

  // Restore timer from localStorage on mount
  useEffect(() => {
    const saved = loadTimer();
    if (saved) {
      timerRef.current = saved;
      setTimerState(saved);
    }
  }, []);

  // Pause timer on sign-out
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") pauseTimer();
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();

    let q = supabase
      .from("items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .or(`state.neq.done,completed_at.gte.${viewDateStr}T00:00:00`);

    if (entityId) q = q.eq("entity_id", entityId);

    q.then(({ data }) =>
      setItems((data ?? []).map((r) => normalizeItem(r as Record<string, unknown>)))
    );

    const channel = supabase
      .channel(`today:${workspaceId}:${entityId ?? "all"}:${viewDateStr}`)
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
          if (item.state === "done") return;
          setItems((prev) => (prev.find((i) => i.id === item.id) ? prev : [...prev, item]));
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
          setItems((prev) => {
            const exists = prev.some((i) => i.id === updated.id);
            // Drop done items completed on a different day
            if (updated.state === "done" && !updated.completed_at?.startsWith(viewDateStr)) {
              return prev.filter((i) => i.id !== updated.id);
            }
            return exists
              ? prev.map((i) => (i.id === updated.id ? updated : i))
              : updated.state !== "done"
                ? [...prev, updated]
                : prev;
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
  }, [workspaceId, entityId, viewDateStr]);

  // Inject freshly-created item (optimistic, before realtime fires)
  useEffect(() => {
    if (!pendingItem || pendingItem.state === "done") return;
    if (entityId && pendingItem.entity_id !== entityId) return;
    setItems((prev) => (prev.find((i) => i.id === pendingItem.id) ? prev : [...prev, pendingItem]));
  }, [pendingItem, entityId]);

  // Scroll to current time when schedule opens
  useEffect(() => {
    if (!scheduleScrollRef.current || !scheduleOpen) return;
    const now = new Date();
    const h = now.getHours();
    if (h < SCHEDULE_START || h >= SCHEDULE_END) return;
    scheduleScrollRef.current.scrollTop = Math.max(0, (h - SCHEDULE_START - 1) * PX_PER_HOUR);
  }, [scheduleOpen]);

  // Escape clears multi-selection
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedIds(new Set());
        setAnchorItemId(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Timer operations ──────────────────────────────────────────────────────

  function startTimerFor(itemId: string) {
    // Read banked ms from the item's DB-persisted field
    const banked = items.find((i) => i.id === itemId)?.time_spent_ms ?? 0;
    setTimer({ itemId, elapsed: banked, startedAt: Date.now() });
  }

  function pauseTimer() {
    setTimer((prev) => {
      if (!prev?.startedAt) return prev;
      return { ...prev, elapsed: prev.elapsed + (Date.now() - prev.startedAt), startedAt: null };
    });
  }

  function resumeTimer() {
    setTimer((prev) => {
      if (!prev || prev.startedAt) return prev;
      return { ...prev, startedAt: Date.now() };
    });
  }

  // Stop timer and return { minutes, time_spent_ms } for the caller to include in its updateItem.
  // Does NOT call updateItem itself — avoids the realtime flash from two separate DB writes.
  function stopTimerAndGetMinutes(saveForLater = false): {
    minutes: number;
    time_spent_ms: number;
  } {
    const t = timerRef.current;
    if (!t) return { minutes: 0, time_spent_ms: 0 };
    const ms = timerMs(t);
    const newMs = saveForLater ? ms : 0;
    setItems((prev) => prev.map((i) => (i.id === t.itemId ? { ...i, time_spent_ms: newMs } : i)));
    setTimer(null);
    return { minutes: Math.max(1, Math.round(ms / 60000)), time_spent_ms: newMs };
  }

  function handleResetTimer(itemId: string) {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, time_spent_ms: 0 } : i)));
    void updateItem(itemId, { time_spent_ms: 0 });
    if (timer?.itemId === itemId) {
      setTimer({ itemId, elapsed: 0, startedAt: Date.now() });
    }
  }

  // ── Handlers: focus actions ───────────────────────────────────────────────

  function handleScheduleItem(id: string, date: string, time: string | null) {
    const updates = { state: "planned" as const, scheduled_date: date, scheduled_time: time };
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    void updateItem(id, updates);
  }

  function setFocusItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || item.state === "focus") return;
    const currentFocus = items.filter((i) => i.state === "focus");
    if (currentFocus.length > 0) {
      autoSwapFocus(id, currentFocus[0]!);
      return;
    }
    setPrevFocusStates((prev) => new Map(prev).set(id, item.state as SectionState));
    startTimerFor(id);
    applyDrop(id, "focus");
  }

  function moveToSomeday(id: string) {
    const updates = { state: "someday" as const, scheduled_date: viewDateStr };
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    void updateItem(id, updates);
  }

  function handleLater(item: ItemData) {
    const { time_spent_ms } = stopTimerAndGetMinutes(true);
    const targetState = prevFocusStates.get(item.id) ?? "unplanned";
    setPrevFocusStates((prev) => {
      const next = new Map(prev);
      next.delete(item.id);
      return next;
    });
    const scheduled_date =
      targetState === "planned" || targetState === "someday"
        ? (item.scheduled_date ?? viewDateStr)
        : null;
    const updates = { state: targetState, scheduled_date, time_spent_ms };
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...updates } : i)));
    void updateItem(item.id, updates);
  }

  function completeItem(id: string, extraUpdates: Record<string, unknown> = {}) {
    const completedAt = new Date().toISOString();
    setCompletingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, state: "done", completed_at: completedAt, ...extraUpdates } : i
        )
      );
      setCompletingIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      void updateItem(id, {
        state: "done",
        completed_at: completedAt,
        ...extraUpdates,
      } as Parameters<typeof updateItem>[1]);
    }, 350);
  }

  function handleFocusDone(item: ItemData) {
    const { minutes, time_spent_ms } = stopTimerAndGetMinutes(false);
    completeItem(item.id, { duration_actual: minutes, time_spent_ms });
  }

  // ── Handlers: regular completion + delete ─────────────────────────────────

  function handleCheckbox(item: ItemData) {
    completeItem(item.id);
  }

  function handleToggleSubtask(item: ItemData, subtaskId: string) {
    const newSubtasks = item.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, done: !s.done } : s
    );
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, subtasks: newSubtasks } : i)));
    void updateItem(item.id, { subtasks: newSubtasks });
  }

  function handleContextMenu(e: React.MouseEvent, item: ItemData) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ item, x: e.clientX, y: e.clientY });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    if (timer?.itemId === deleteTarget.id) setTimer(null);
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    await deleteItem(deleteTarget.id);
    setDeleteTarget(null);
    setDeleting(false);
  }

  // ── Handlers: drag ────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, item: ItemData) {
    const ids = selectedIds.has(item.id) ? new Set(selectedIds) : new Set([item.id]);
    setDragItemId(item.id);
    setDragIds(ids);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDragItemId(null);
    setDragIds(new Set());
    setSelectedIds(new Set());
    setAnchorItemId(null);
    setDragOverSection(null);
    setDragOverHour(null);
    setDragOverItemId(null);
  }

  function handleSectionDragOver(e: React.DragEvent, state: SectionState) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverSection !== state) setDragOverSection(state);
    setDragOverHour(null);
  }

  function handleSectionDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverSection(null);
      setDragOverItemId(null);
    }
  }

  function handleItemDragOver(_e: React.DragEvent, itemId: string) {
    if (dragOverItemId !== itemId) setDragOverItemId(itemId);
  }

  function handleItemDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverItemId(null);
    }
  }

  function clearDragState() {
    setDragItemId(null);
    setDragIds(new Set());
    setDragOverSection(null);
    setDragOverHour(null);
    setDragOverItemId(null);
  }

  function handleItemSelect(e: React.MouseEvent, item: ItemData) {
    e.stopPropagation();
    if (e.shiftKey && anchorItemId) {
      const flat = visibleSections.flatMap((s) => s.items);
      const anchorIdx = flat.findIndex((i) => i.id === anchorItemId);
      const clickIdx = flat.findIndex((i) => i.id === item.id);
      if (anchorIdx !== -1 && clickIdx !== -1) {
        const [lo, hi] = anchorIdx <= clickIdx ? [anchorIdx, clickIdx] : [clickIdx, anchorIdx];
        setSelectedIds(new Set(flat.slice(lo, hi + 1).map((i) => i.id)));
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle selection only — do NOT open the detail panel
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
      setAnchorItemId(item.id);
    } else {
      setSelectedIds(new Set([item.id]));
      setAnchorItemId(item.id);
      onSelectItem(item.id);
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setAnchorItemId(null);
  }

  function applyDrop(
    id: string,
    targetState: SectionState,
    position?: number,
    extra: Partial<Parameters<typeof updateItem>[1]> = {}
  ) {
    const dateUpdates =
      targetState === "planned" || targetState === "someday"
        ? { scheduled_date: viewDateStr }
        : targetState === "unplanned"
          ? { scheduled_date: null }
          : {};
    const updates = {
      state: targetState,
      ...dateUpdates,
      ...(position !== undefined ? { position } : {}),
      ...extra,
    };
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    void updateItem(id, updates);
  }

  function reorderWithinSection(
    draggedId: string,
    sectionState: SectionState,
    insertBeforeId: string | null
  ) {
    const sectionItems = sections.find((s) => s.state === sectionState)?.items ?? [];
    const dragged = sectionItems.find((i) => i.id === draggedId);
    if (!dragged) return;

    const withoutDragged = sectionItems.filter((i) => i.id !== draggedId);
    const insertIdx =
      insertBeforeId !== null ? withoutDragged.findIndex((i) => i.id === insertBeforeId) : -1;
    const finalIdx = insertIdx === -1 ? withoutDragged.length : insertIdx;

    const reordered = [
      ...withoutDragged.slice(0, finalIdx),
      dragged,
      ...withoutDragged.slice(finalIdx),
    ];

    const positionMap = new Map(reordered.map((item, idx) => [item.id, idx]));
    setItems((prev) =>
      prev.map((i) => {
        const newPos = positionMap.get(i.id);
        return newPos !== undefined && newPos !== i.position ? { ...i, position: newPos } : i;
      })
    );
    reordered.forEach((item, idx) => {
      if (item.position !== idx) void updateItem(item.id, { position: idx });
    });
  }

  function reorderMultipleWithinSection(
    draggedIds: string[],
    sectionState: SectionState,
    insertBeforeId: string | null
  ) {
    const sectionItems = sections.find((s) => s.state === sectionState)?.items ?? [];
    const dragSet = new Set(draggedIds);
    const draggedInOrder = sectionItems.filter((i) => dragSet.has(i.id));
    const withoutDragged = sectionItems.filter((i) => !dragSet.has(i.id));
    const insertIdx =
      insertBeforeId !== null ? withoutDragged.findIndex((i) => i.id === insertBeforeId) : -1;
    const finalIdx = insertIdx === -1 ? withoutDragged.length : insertIdx;
    const reordered = [
      ...withoutDragged.slice(0, finalIdx),
      ...draggedInOrder,
      ...withoutDragged.slice(finalIdx),
    ];
    const positionMap = new Map(reordered.map((item, idx) => [item.id, idx]));
    setItems((prev) =>
      prev.map((i) => {
        const newPos = positionMap.get(i.id);
        return newPos !== undefined && newPos !== i.position ? { ...i, position: newPos } : i;
      })
    );
    reordered.forEach((item, idx) => {
      if (item.position !== idx) void updateItem(item.id, { position: idx });
    });
  }

  function handleSectionDrop(e: React.DragEvent, targetState: SectionState) {
    e.preventDefault();
    const id = dragItemId;
    const allDragIds = dragIds.size > 0 ? dragIds : id ? new Set([id]) : new Set<string>();
    const insertBeforeId = dragOverItemId;
    clearDragState();
    if (!id || allDragIds.size === 0) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Stop timer if primary dragged item leaves focus — bundle into same DB write
    const extra: Partial<Parameters<typeof updateItem>[1]> = {};
    if (item.state === "focus" && targetState !== "focus") {
      const { time_spent_ms } = stopTimerAndGetMinutes(true);
      extra.time_spent_ms = time_spent_ms;
    }

    // Dropping to done
    if (targetState === "done") {
      allDragIds.forEach((did) => completeItem(did));
      return;
    }

    // Focus: only allow single-item
    if (targetState === "focus") {
      if (allDragIds.size > 1) return;
      const currentFocus = items.filter((i) => i.state === "focus" && i.id !== id);
      if (currentFocus.length > 0) {
        autoSwapFocus(id, currentFocus[0]!);
        return;
      }
      if (item.state !== "focus") {
        setPrevFocusStates((prev) => new Map(prev).set(id, item.state as SectionState));
        startTimerFor(id);
      }
    }

    // Single item — existing reorder/move logic
    if (allDragIds.size === 1) {
      if (item.state === targetState) {
        reorderWithinSection(id, targetState, insertBeforeId);
        return;
      }
      const targetItems = sections.find((s) => s.state === targetState)?.items ?? [];
      applyDrop(id, targetState, targetItems.length, extra);
      return;
    }

    // Multi-item — check if all are in the same section
    const draggedItems = items.filter((i) => allDragIds.has(i.id));
    if (draggedItems.every((i) => i.state === targetState)) {
      reorderMultipleWithinSection(Array.from(allDragIds), targetState, insertBeforeId);
      return;
    }

    // Multi-item cross-section: append all to target in current relative order
    const targetItems = sections.find((s) => s.state === targetState)?.items ?? [];
    const basePosition = targetItems.length;
    draggedItems.forEach((di, idx) => {
      const itemExtra = di.id === id ? extra : {};
      applyDrop(di.id, targetState, basePosition + idx, itemExtra);
    });
  }

  function autoSwapFocus(incomingId: string, currentFocusItem: ItemData) {
    const incomingItem = items.find((i) => i.id === incomingId);
    if (!incomingItem) return;
    // Look up where the current focus item came from before mutating the map
    const displacedState = prevFocusStates.get(currentFocusItem.id) ?? "planned";
    // Update map: record incoming's origin, drop current focus's entry
    setPrevFocusStates((prev) => {
      const next = new Map(prev);
      next.set(incomingId, incomingItem.state as SectionState);
      next.delete(currentFocusItem.id);
      return next;
    });
    // Bank timer and restore current focus to its previous section
    const { time_spent_ms } = stopTimerAndGetMinutes(true);
    const displaced_date =
      displacedState === "planned" || displacedState === "someday"
        ? (currentFocusItem.scheduled_date ?? viewDateStr)
        : null;
    const displaced = { state: displacedState, scheduled_date: displaced_date, time_spent_ms };
    setItems((prev) =>
      prev.map((i) => (i.id === currentFocusItem.id ? { ...i, ...displaced } : i))
    );
    void updateItem(currentFocusItem.id, displaced);
    // Move incoming → focus
    startTimerFor(incomingId);
    applyDrop(incomingId, "focus");
  }

  function handleHourDragOver(e: React.DragEvent, hour: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverHour !== hour) setDragOverHour(hour);
    setDragOverSection(null);
  }

  function handleHourDrop(e: React.DragEvent, hour: number) {
    e.preventDefault();
    const anchorId = dragItemId;
    const allDragIds =
      dragIds.size > 0 ? dragIds : anchorId ? new Set([anchorId]) : new Set<string>();
    clearDragState();
    if (allDragIds.size === 0) return;
    const h = Math.floor(hour);
    const m = hour !== h ? 30 : 0;
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    allDragIds.forEach((id) => {
      const dragItem = items.find((i) => i.id === id);
      const needsState =
        dragItem && (dragItem.state === "carry-on" || dragItem.state === "unplanned");
      const updates = needsState
        ? { scheduled_time: time, scheduled_date: viewDateStr, state: "planned" as const }
        : { scheduled_time: time, scheduled_date: viewDateStr };
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
      void updateItem(id, updates);
    });
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const sections = SECTIONS.map((s) => {
    const filtered = items.filter((i) => {
      if (i.state !== s.state) return false;
      switch (s.state) {
        case "focus":
        case "carry-on":
          return true;
        case "planned":
          return i.scheduled_date === viewDateStr;
        case "unplanned":
          return i.scheduled_date === null || i.scheduled_date === viewDateStr;
        case "someday":
          return i.scheduled_date === viewDateStr;
        case "done":
          return i.completed_at?.startsWith(viewDateStr) ?? false;
      }
    });
    // Planned: timed items first sorted by time, then untimed by position
    const sortedItems = [...filtered].sort((a, b) => {
      if (s.state === "planned") {
        if (a.scheduled_time && b.scheduled_time)
          return a.scheduled_time.localeCompare(b.scheduled_time);
        if (a.scheduled_time) return -1;
        if (b.scheduled_time) return 1;
      }
      if (a.position !== b.position) return a.position - b.position;
      return a.created_at.localeCompare(b.created_at);
    });
    return { ...s, items: sortedItems };
  });

  const ALWAYS_VISIBLE = new Set(["focus", "planned", "unplanned", "done"]);
  const visibleSections = sections.filter((s) => ALWAYS_VISIBLE.has(s.state) || s.items.length > 0);

  const focusItems = sections.find((s) => s.state === "focus")?.items ?? [];

  const scheduledItems = items
    .filter((i) => i.scheduled_date === viewDateStr && i.scheduled_time)
    .sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? ""));

  const scheduleLayout = computeScheduleLayout(scheduledItems);

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = scheduleWidth;
    setIsResizing(true);

    function onMouseMove(ev: MouseEvent) {
      const delta = startX - ev.clientX;
      setScheduleWidth(Math.max(160, Math.min(600, startWidth + delta)));
    }
    function onMouseUp() {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className={cn("flex h-full overflow-hidden", isResizing && "select-none")}>
        {/* ── Task sections ─────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1 overflow-y-auto" onClick={clearSelection}>
          {visibleSections.map((section) => (
            <div
              key={section.state}
              onDragOver={(e) => handleSectionDragOver(e, section.state)}
              onDragLeave={handleSectionDragLeave}
              onDrop={(e) => handleSectionDrop(e, section.state)}
            >
              {/* Section header */}
              <div
                className={cn(
                  "sticky top-0 z-10 flex items-center gap-2 border-b bg-background/90 px-4 py-2 backdrop-blur-sm",
                  section.state === "carry-on" ? "border-red-500/20 bg-red-500/5" : "border-border"
                )}
              >
                <span className={cn("h-2 w-2 flex-none rounded-full", section.dot)} />
                <span className={cn("text-xs font-semibold", section.color)}>{section.label}</span>
                <span
                  className={cn(
                    "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    section.state === "carry-on"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {section.items.length}
                  {section.state === "carry-on" ? " overdue" : ""}
                </span>
              </div>

              {/* Cards */}
              <div
                className={cn(
                  "min-h-[64px] py-2 transition-colors",
                  dragOverSection === section.state && dragItemId && "bg-brand-500/5"
                )}
              >
                {section.state === "focus" ? (
                  // Focus section: FocusCard(s) or drop zone
                  section.items.length === 0 ? (
                    <div
                      className={cn(
                        "mx-4 flex w-[min(100%-2rem,480px)] items-center justify-center rounded-2xl border border-dashed py-6 text-xs transition-colors",
                        dragOverSection === "focus" && dragItemId
                          ? "border-brand-400 bg-brand-500/5 text-brand-500"
                          : "border-border text-muted-foreground/40"
                      )}
                    >
                      Drop a task here to focus on it
                    </div>
                  ) : (
                    section.items.map((item) => {
                      const entity = entities.find((e) => e.id === item.entity_id) ?? null;
                      return (
                        <FocusCard
                          key={item.id}
                          item={item}
                          entity={entity}
                          timer={timer?.itemId === item.id ? timer : null}
                          completing={completingIds.has(item.id)}
                          isDragging={dragIds.has(item.id)}
                          isSelected={selectedIds.has(item.id)}
                          onDragStart={(e) => handleDragStart(e, item)}
                          onDragEnd={handleDragEnd}
                          onSelect={(e) => handleItemSelect(e, item)}
                          onPause={pauseTimer}
                          onResume={resumeTimer}
                          onLater={() => handleLater(item)}
                          onDone={() => handleFocusDone(item)}
                          onToggleSubtask={(subtaskId) => handleToggleSubtask(item, subtaskId)}
                          onContextMenu={(e) => handleContextMenu(e, item)}
                        />
                      );
                    })
                  )
                ) : section.state === "planned" ? (
                  // Planned: 2-col grid
                  section.items.length === 0 ? (
                    <div
                      className={cn(
                        "mx-4 flex w-[min(100%-2rem,480px)] items-center justify-center rounded-xl border border-dashed py-4 text-xs transition-colors",
                        dragOverSection === "planned" && dragItemId
                          ? "border-brand-400 bg-brand-500/5 text-brand-500"
                          : "border-border text-muted-foreground/40"
                      )}
                    >
                      No tasks planned for today
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 px-4">
                      {section.items.map((item) => {
                        const entity = entities.find((e) => e.id === item.entity_id) ?? null;
                        return (
                          <PlannedCard
                            key={item.id}
                            item={item}
                            entity={entity}
                            isDragging={dragIds.has(item.id)}
                            isSelected={selectedIds.has(item.id)}
                            isDragTarget={dragOverItemId === item.id && !dragIds.has(item.id)}
                            onDragStart={(e) => handleDragStart(e, item)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleItemDragOver(e, item.id)}
                            onDragLeave={handleItemDragLeave}
                            onSelect={(e) => handleItemSelect(e, item)}
                            onFocus={() => setFocusItem(item.id)}
                            onContextMenu={(e) => handleContextMenu(e, item)}
                          />
                        );
                      })}
                    </div>
                  )
                ) : section.state === "unplanned" ? (
                  // Unplanned (Later): compact list rows with inline scheduler
                  section.items.length === 0 ? (
                    <div
                      className={cn(
                        "mx-4 flex w-[min(100%-2rem,480px)] items-center justify-center rounded-xl border border-dashed py-4 text-xs transition-colors",
                        dragOverSection === "unplanned" && dragItemId
                          ? "border-brand-400 bg-brand-500/5 text-brand-500"
                          : "border-border text-muted-foreground/40"
                      )}
                    >
                      Drop tasks here to delay them
                    </div>
                  ) : (
                    <div className="py-1">
                      {section.items.map((item) => (
                        <UnplannedRow
                          key={item.id}
                          item={item}
                          isSelected={selectedIds.has(item.id)}
                          isDragging={dragIds.has(item.id)}
                          isDragTarget={dragOverItemId === item.id && !dragIds.has(item.id)}
                          onDragStart={(e) => handleDragStart(e, item)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleItemDragOver(e, item.id)}
                          onDragLeave={handleItemDragLeave}
                          onSelect={(e) => handleItemSelect(e, item)}
                          onSchedule={(date, time) => handleScheduleItem(item.id, date, time)}
                          onContextMenu={(e) => handleContextMenu(e, item)}
                        />
                      ))}
                    </div>
                  )
                ) : section.state === "carry-on" ? (
                  // Carry-on: compact list rows (same as Later) with overdue badge
                  section.items.length === 0 ? (
                    <div
                      className={cn(
                        "mx-4 flex w-[min(100%-2rem,480px)] items-center justify-center rounded-xl border border-dashed py-4 text-xs transition-colors",
                        dragOverSection === "carry-on" && dragItemId
                          ? "border-red-400 bg-red-500/5 text-red-500"
                          : "border-border text-muted-foreground/40"
                      )}
                    >
                      Drop tasks here
                    </div>
                  ) : (
                    <div className="py-1">
                      {section.items.map((item) => (
                        <UnplannedRow
                          key={item.id}
                          item={item}
                          isSelected={selectedIds.has(item.id)}
                          isDragging={dragIds.has(item.id)}
                          isDragTarget={dragOverItemId === item.id && !dragIds.has(item.id)}
                          overdueBadge={overdueBadge(item.scheduled_date)}
                          onDragStart={(e) => handleDragStart(e, item)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleItemDragOver(e, item.id)}
                          onDragLeave={handleItemDragLeave}
                          onSelect={(e) => handleItemSelect(e, item)}
                          onSchedule={(date, time) => handleScheduleItem(item.id, date, time)}
                          onContextMenu={(e) => handleContextMenu(e, item)}
                        />
                      ))}
                    </div>
                  )
                ) : // Other sections (someday, done): TaskCards
                section.items.length === 0 ? (
                  <div
                    className={cn(
                      "mx-4 flex w-[min(100%-2rem,480px)] items-center justify-center rounded-xl border border-dashed py-4 text-xs transition-colors",
                      dragOverSection === section.state && dragItemId
                        ? "border-brand-400 bg-brand-500/5 text-brand-500"
                        : "border-border text-muted-foreground/40"
                    )}
                  >
                    {section.state === "done"
                      ? "Drop tasks here to mark them done"
                      : "Drop tasks here"}
                  </div>
                ) : (
                  section.items.map((item) => (
                    <TaskCard
                      key={item.id}
                      item={item}
                      completing={completingIds.has(item.id)}
                      isDragging={dragIds.has(item.id)}
                      isSelected={selectedIds.has(item.id)}
                      isDragTarget={dragOverItemId === item.id && !dragIds.has(item.id)}
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleItemDragOver(e, item.id)}
                      onDragLeave={handleItemDragLeave}
                      onCheckbox={() => handleCheckbox(item)}
                      onSelect={(e) => handleItemSelect(e, item)}
                      onContextMenu={(e) => handleContextMenu(e, item)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}

          {/* New task shortcut at bottom */}
          <div className="mx-4 pb-28 pt-2">
            <button
              onClick={onNewTask}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground/50 transition-colors hover:border-brand-400/50 hover:text-brand-500"
            >
              <Plus size={12} />
              New task
            </button>
          </div>
        </div>

        {/* ── Resize handle ──────────────────────────────────────────────── */}
        {scheduleOpen && (
          <div
            className={cn(
              "w-1 flex-none cursor-col-resize bg-transparent transition-colors hover:bg-brand-500/40",
              isResizing && "bg-brand-500/40"
            )}
            onMouseDown={handleResizeStart}
          />
        )}

        {/* ── Schedule panel ─────────────────────────────────────────────── */}
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
                  title="Collapse schedule"
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronRight size={13} />
                </button>
              </div>

              {/* Focus pinned block */}
              {focusItems.length > 0 && (
                <div className="flex-none space-y-1.5 border-b border-border px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-500">
                    Focus
                  </p>
                  {focusItems.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onSelectItem(item.id)}
                      className={cn(
                        "cursor-pointer rounded-lg border border-brand-500/30 bg-brand-500/10 px-2.5 py-1.5 transition-all hover:bg-brand-500/20",
                        selectedIds.has(item.id) && "ring-1 ring-brand-500",
                        dragIds.has(item.id) && "opacity-30"
                      )}
                    >
                      <p className="line-clamp-2 text-xs font-medium leading-snug text-brand-600 dark:text-brand-400">
                        {item.title}
                      </p>
                      {timer?.itemId === item.id && (
                        <p className="mt-0.5 font-mono text-[10px] text-brand-500/70">
                          {formatElapsed(timerMs(timer))}
                        </p>
                      )}
                      {item.scheduled_time && (
                        <p className="mt-0.5 text-[10px] text-brand-500/70">
                          {formatTime(item.scheduled_time)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div ref={scheduleScrollRef} className="flex-1 overflow-y-auto py-2">
                <div className="relative" style={{ height: HOURS.length * PX_PER_HOUR + 16 }}>
                  {/* Hour rows — split into :00 and :30 drop targets */}
                  {HOURS.map((h, i) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0"
                      style={{ top: i * PX_PER_HOUR + 8, height: PX_PER_HOUR }}
                    >
                      {/* On-the-hour zone */}
                      <div
                        className={cn("absolute inset-x-0 top-0 transition-colors")}
                        style={{ height: PX_PER_HOUR / 2 }}
                        onDragOver={(e) => handleHourDragOver(e, h)}
                        onDrop={(e) => handleHourDrop(e, h)}
                      >
                        {dragOverHour === h && dragItemId && (
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
                              dragOverHour === h && dragItemId ? "bg-brand-400/60" : "bg-border/60"
                            )}
                          />
                        </div>
                      </div>

                      {/* Half-hour zone */}
                      <div
                        className="absolute inset-x-0 bottom-0 transition-colors"
                        style={{ height: PX_PER_HOUR / 2 }}
                        onDragOver={(e) => handleHourDragOver(e, h + 0.5)}
                        onDrop={(e) => handleHourDrop(e, h + 0.5)}
                      >
                        {dragOverHour === h + 0.5 && dragItemId && (
                          <div className="absolute inset-0 bg-brand-500/10" />
                        )}
                        <div className="flex items-center">
                          <span className="w-12 flex-none pr-2 text-right text-[9px] tabular-nums text-muted-foreground/25">
                            :30
                          </span>
                          <div
                            className={cn(
                              "h-px w-5 transition-colors",
                              dragOverHour === h + 0.5 && dragItemId
                                ? "bg-brand-400/60"
                                : "bg-border/30"
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {isViewingToday && <CurrentTimeLine />}

                  {/* Scheduled items — draggable within calendar */}
                  {scheduledItems.map((item) => {
                    const top = timeToTop(item.scheduled_time!) + 8;
                    const height = item.duration_estimate
                      ? Math.max((item.duration_estimate / 60) * PX_PER_HOUR, 28)
                      : 28;
                    const { col, totalCols } = scheduleLayout.get(item.id) ?? {
                      col: 0,
                      totalCols: 1,
                    };
                    // Pre-compute % + px to avoid CSS calc * operator (unreliable with mixed units)
                    const colWidthPct = 100 / totalCols;
                    const gutter = 60; // 52px label + 8px right margin
                    const colWidthPxCut = gutter / totalCols;
                    const leftPct = col * colWidthPct;
                    const leftPx = 52 - col * colWidthPxCut;
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onSelectItem(item.id)}
                        className={cn(
                          "absolute cursor-pointer overflow-hidden rounded-lg border border-brand-500/20 bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-600 transition-all hover:bg-brand-500/20 dark:text-brand-400",
                          selectedIds.has(item.id) && "ring-1 ring-brand-500",
                          dragIds.has(item.id) && "opacity-30",
                          // Let drag events pass through to hour zones beneath when another item is being dragged
                          dragIds.size > 0 && !dragIds.has(item.id) && "pointer-events-none"
                        )}
                        style={{
                          top,
                          height,
                          left: `calc(${leftPct}% + ${leftPx}px)`,
                          width: `calc(${colWidthPct}% - ${colWidthPxCut + 4}px)`,
                        }}
                      >
                        <span className="line-clamp-2 leading-tight">{item.title}</span>
                        {item.duration_estimate != null && height > 36 && (
                          <span className="mt-0.5 block text-[10px] text-brand-500/70">
                            {formatDuration(item.duration_estimate)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={() => setScheduleOpen(true)}
              title="Expand schedule"
              className="flex h-full w-full flex-col items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Context menu ────────────────────────────────────────────────── */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            className="fixed z-50 min-w-[180px] overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.item.state !== "focus" && (
              <button
                onClick={() => {
                  setFocusItem(contextMenu.item.id);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <PlayIcon size={12} className="text-brand-500" />
                Set as focus
              </button>
            )}
            <button
              onClick={() => {
                onSelectItem(contextMenu.item.id);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Pencil size={12} className="text-muted-foreground" />
              Edit
            </button>
            <button
              onClick={() => {
                onSelectItem(contextMenu.item.id);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Calendar size={12} className="text-muted-foreground" />
              Reschedule
            </button>
            {contextMenu.item.state !== "someday" && (
              <button
                onClick={() => {
                  moveToSomeday(contextMenu.item.id);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <MoveRight size={12} className="text-muted-foreground" />
                Move to someday
              </button>
            )}
            {(contextMenu.item.state === "focus" || (contextMenu.item.time_spent_ms ?? 0) > 0) && (
              <button
                onClick={() => {
                  handleResetTimer(contextMenu.item.id);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <RotateCcw size={12} className="text-muted-foreground" />
                Reset timer
              </button>
            )}
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => {
                setDeleteTarget(contextMenu.item);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-muted"
            >
              <Trash2 size={12} />
              Delete task
            </button>
          </div>
        </>
      )}

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative w-full max-w-xs rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <p className="text-sm font-semibold text-foreground">Delete this task?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              &ldquo;{deleteTarget.title}&rdquo; will be permanently removed. This cannot be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmDelete()}
                disabled={deleting}
                className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
