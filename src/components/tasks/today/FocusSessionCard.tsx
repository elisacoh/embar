"use client";

import { useState, useEffect } from "react";
import { Pause, Play, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionData } from "@/lib/types";
import { sessionTimerMs, type SessionTimerState } from "./types";
import { formatElapsed, formatDuration } from "./utils";

interface FocusSessionCardProps {
  session: SessionData;
  timer: SessionTimerState | null;
  isDragging: boolean;
  isSelected: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onPause: () => void;
  onResume: () => void;
  onContinue: () => void;
  onDone: () => void;
}

export function FocusSessionCard({
  session,
  timer,
  isDragging,
  isSelected,
  onDragStart,
  onDragEnd,
  onSelect,
  onPause,
  onResume,
  onContinue,
  onDone,
}: FocusSessionCardProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!timer?.startedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer?.startedAt]);

  const isRunning = !!timer?.startedAt;
  const elapsedMs = timer ? sessionTimerMs(timer) : 0;
  const total = session.total_units ?? 0;
  const pct = total > 0 ? Math.round((session.completed_units / total) * 100) : 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        "mx-4 mb-3 w-[min(100%-2rem,480px)] cursor-pointer select-none overflow-hidden rounded-2xl border-2 shadow-lg transition-all",
        "border-brand-500/50 bg-gradient-to-br from-brand-500/10 via-brand-500/5 to-transparent",
        "shadow-brand-500/10 hover:shadow-brand-500/20",
        isSelected && "ring-2 ring-brand-500/60",
        isDragging && "opacity-30 shadow-none"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-brand-500/10 px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-500/70">
          Session
        </span>
        {session.duration_estimate != null && (
          <span className="ml-auto text-[10px] text-muted-foreground/50">
            {formatDuration(session.duration_estimate)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pb-3 pt-3">
        <p className="text-sm font-semibold leading-snug text-foreground">{session.title}</p>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span
            className={cn(
              "font-mono text-2xl font-bold tabular-nums tracking-tight",
              isRunning ? "text-brand-500" : "text-muted-foreground"
            )}
          >
            {formatElapsed(elapsedMs)}
          </span>
        </div>
        {total > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-brand-500/10">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="flex-none text-[10px] tabular-nums text-muted-foreground/50">
              {session.completed_units}/{total}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
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
            onContinue();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted"
        >
          <ArrowUpRight size={11} />
          Continue
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
