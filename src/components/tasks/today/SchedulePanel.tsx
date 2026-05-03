"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItemData, SessionData } from "@/lib/types";
import { timerMs, type TimerState } from "./types";
import {
  HOURS,
  PX_PER_HOUR,
  SCHEDULE_START,
  SCHEDULE_END,
  formatElapsed,
  formatTime,
  formatDuration,
  timeToTop,
} from "./utils";

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

// ── Schedule panel ────────────────────────────────────────────────────────────

interface SchedulePanelProps {
  sessions: SessionData[];
  scheduledItems: ItemData[];
  scheduleLayout: Map<string, { col: number; totalCols: number }>;
  focusItems: ItemData[];
  timer: TimerState | null;
  scheduleOpen: boolean;
  scheduleWidth: number;
  isResizing: boolean;
  isViewingToday: boolean;
  selectedIds: Set<string>;
  dragIds: Set<string>;
  dragItemId: string | null;
  dragSessionId: string | null;
  dragOverHour: number | null;
  scheduleScrollRef: React.RefObject<HTMLDivElement>;
  onToggleOpen: (open: boolean) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onSelectItem: (id: string) => void;
  onOpenSession: (session: SessionData) => void;
  onDragStartItem: (e: React.DragEvent, item: ItemData) => void;
  onDragEndItem: () => void;
  onSessionDragStart: (e: React.DragEvent, sessionId: string) => void;
  onSessionDragEnd: () => void;
  onHourDragOver: (e: React.DragEvent, hour: number) => void;
  onHourDrop: (e: React.DragEvent, hour: number) => void;
}

export function SchedulePanel({
  sessions,
  scheduledItems,
  scheduleLayout,
  focusItems,
  timer,
  scheduleOpen,
  scheduleWidth,
  isResizing,
  isViewingToday,
  selectedIds,
  dragIds,
  dragItemId,
  dragSessionId,
  dragOverHour,
  scheduleScrollRef,
  onToggleOpen,
  onResizeStart,
  onSelectItem,
  onOpenSession,
  onDragStartItem,
  onDragEndItem,
  onSessionDragStart,
  onSessionDragEnd,
  onHourDragOver,
  onHourDrop,
}: SchedulePanelProps) {
  return (
    <>
      {/* Resize handle */}
      {scheduleOpen && (
        <div
          className={cn(
            "w-1 flex-none cursor-col-resize bg-transparent transition-colors hover:bg-brand-500/40",
            isResizing && "bg-brand-500/40"
          )}
          onMouseDown={onResizeStart}
        />
      )}

      {/* Panel */}
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
            {/* Header */}
            <div className="flex h-9 flex-none items-center justify-between border-b border-border px-3">
              <span className="text-xs font-semibold text-muted-foreground">Schedule</span>
              <button
                onClick={() => onToggleOpen(false)}
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
                    onDragStart={(e) => onDragStartItem(e, item)}
                    onDragEnd={onDragEndItem}
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

            {/* Scrollable grid */}
            <div ref={scheduleScrollRef} className="flex-1 overflow-y-auto py-2">
              <div className="relative" style={{ height: HOURS.length * PX_PER_HOUR + 16 }}>
                {/* Hour rows */}
                {HOURS.map((h, i) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0"
                    style={{ top: i * PX_PER_HOUR + 8, height: PX_PER_HOUR }}
                  >
                    {/* On-the-hour zone */}
                    <div
                      className="absolute inset-x-0 top-0 transition-colors"
                      style={{ height: PX_PER_HOUR / 2 }}
                      onDragOver={(e) => onHourDragOver(e, h)}
                      onDrop={(e) => onHourDrop(e, h)}
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
                      onDragOver={(e) => onHourDragOver(e, h + 0.5)}
                      onDrop={(e) => onHourDrop(e, h + 0.5)}
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

                {/* Scheduled sessions */}
                {sessions
                  .filter((s) => s.scheduled_time)
                  .map((s) => {
                    const top = timeToTop(s.scheduled_time!) + 8;
                    const height = s.duration_estimate
                      ? Math.max((s.duration_estimate / 60) * PX_PER_HOUR, 28)
                      : 28;
                    return (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={(e) => onSessionDragStart(e, s.id)}
                        onDragEnd={onSessionDragEnd}
                        onClick={() => onOpenSession(s)}
                        className={cn(
                          "absolute cursor-pointer overflow-hidden rounded-lg border border-brand-500/40 bg-brand-500/15 px-2 py-1 text-xs font-medium text-brand-600 transition-all hover:bg-brand-500/25 dark:text-brand-400",
                          dragSessionId === s.id && "opacity-30"
                        )}
                        style={{ top, height, left: "52px", right: "4px" }}
                      >
                        <span className="line-clamp-2 leading-tight">{s.title}</span>
                      </div>
                    );
                  })}

                {/* Scheduled items */}
                {scheduledItems.map((item) => {
                  const top = timeToTop(item.scheduled_time!) + 8;
                  const height = item.duration_estimate
                    ? Math.max((item.duration_estimate / 60) * PX_PER_HOUR, 28)
                    : 28;
                  const { col, totalCols } = scheduleLayout.get(item.id) ?? {
                    col: 0,
                    totalCols: 1,
                  };
                  const colWidthPct = 100 / totalCols;
                  const gutter = 60;
                  const colWidthPxCut = gutter / totalCols;
                  const leftPct = col * colWidthPct;
                  const leftPx = 52 - col * colWidthPxCut;
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => onDragStartItem(e, item)}
                      onDragEnd={onDragEndItem}
                      onClick={() => onSelectItem(item.id)}
                      className={cn(
                        "absolute cursor-pointer overflow-hidden rounded-lg border border-brand-500/20 bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-600 transition-all hover:bg-brand-500/20 dark:text-brand-400",
                        selectedIds.has(item.id) && "ring-1 ring-brand-500",
                        dragIds.has(item.id) && "opacity-30",
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
            onClick={() => onToggleOpen(true)}
            title="Expand schedule"
            className="flex h-full w-full flex-col items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft size={13} />
          </button>
        )}
      </div>
    </>
  );
}
