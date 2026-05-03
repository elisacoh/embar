"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItemData } from "@/lib/types";
import type { DragTargetProps } from "./types";
import { TODAY } from "./utils";

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

export function UnplannedRow({
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
