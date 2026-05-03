"use client";

import { cn } from "@/lib/utils";
import type { ItemData, SessionData } from "@/lib/types";
import { formatDuration } from "./utils";

interface DoneTaskRowProps {
  item: ItemData;
  isDragging: boolean;
  isDragTarget: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onSelect: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function DoneTaskRow({
  item,
  isDragging,
  isDragTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onSelect,
  onContextMenu,
}: DoneTaskRowProps) {
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
        "group relative flex cursor-grab items-center gap-3 px-4 py-1.5 transition-colors hover:bg-muted/40",
        isDragging && "opacity-30"
      )}
    >
      {isDragTarget && <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-500" />}
      <div className="h-1.5 w-1.5 flex-none rounded-full bg-green-500/60" />
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/60 line-through">
        {item.title}
      </span>
      {(item.time_spent_ms > 0 || item.duration_actual) && (
        <span className="flex-none text-[10px] tabular-nums text-muted-foreground/40">
          {item.time_spent_ms > 0
            ? formatDuration(Math.max(1, Math.round(item.time_spent_ms / 60000)))
            : formatDuration(item.duration_actual!)}
        </span>
      )}
    </div>
  );
}

interface DoneSessionRowProps {
  session: SessionData;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
}

export function DoneSessionRow({
  session,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
}: DoneSessionRowProps) {
  const total = session.total_units ?? 0;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      className={cn(
        "group relative flex cursor-grab items-center gap-3 px-4 py-1.5 transition-colors hover:bg-muted/40",
        isDragging && "opacity-30"
      )}
    >
      <div className="h-1.5 w-1.5 flex-none rounded-full bg-brand-500/50" />
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/60 line-through">
        {session.title}
      </span>
      <span className="flex-none rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:text-brand-400">
        📋 Session
      </span>
      {total > 0 && (
        <span className="flex-none text-[10px] tabular-nums text-muted-foreground/40">
          {session.completed_units}/{total}
        </span>
      )}
    </div>
  );
}
