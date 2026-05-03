"use client";

import { cn } from "@/lib/utils";
import type { SessionData } from "@/lib/types";

interface SessionCardProps {
  session: SessionData;
  isDragging: boolean;
  isDragTarget: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onSelect: () => void;
  onStart: () => void;
}

export function SessionCard({
  session,
  isDragging,
  isDragTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onSelect,
  onStart,
}: SessionCardProps) {
  const total = session.total_units ?? 0;
  const completedCount = session.completed_units;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const isActive = session.status === "active";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onClick={onSelect}
      className={cn(
        "group relative w-44 cursor-pointer select-none overflow-hidden rounded-xl border transition-all hover:shadow-sm",
        "border-brand-500/30 bg-brand-500/[0.04] hover:border-brand-500/50",
        isDragging && "opacity-30",
        isDragTarget && "ring-1 ring-brand-500"
      )}
    >
      {isDragTarget && <div className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-brand-500" />}

      <div className="absolute inset-y-0 left-0 w-[3px] bg-brand-500" />

      <div className="flex flex-col gap-2 p-3 pl-4">
        <div className="flex items-start gap-1">
          <p className="min-w-0 flex-1 text-xs font-medium leading-snug text-foreground">
            {session.title}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStart();
            }}
            className={cn(
              "flex-none rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
              "opacity-0 group-hover:opacity-100",
              isActive
                ? "bg-brand-500 text-white"
                : "bg-brand-500/10 text-brand-600 dark:text-brand-400"
            )}
          >
            {isActive ? "Continue" : "Start"}
          </button>
        </div>

        {total > 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-brand-500/10">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="flex-none text-[10px] tabular-nums text-muted-foreground/50">
              {completedCount}/{total}
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/40">No tasks</p>
        )}
      </div>
    </div>
  );
}
