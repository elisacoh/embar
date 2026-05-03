"use client";

import { useState } from "react";
import { ChevronDown, Play as PlayIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItemData, EntityData } from "@/lib/types";
import type { DragTargetProps } from "./types";
import { formatTime, formatDuration, formatDate } from "./utils";

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

export function PlannedCard({
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

      {hasAccent && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[3px]",
            isCritical ? "bg-destructive" : "bg-amber-400"
          )}
        />
      )}

      <div className={cn("flex flex-col gap-2 p-3", hasAccent && "pl-4")}>
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

        <p className="line-clamp-3 text-sm font-medium leading-snug text-foreground">
          {item.title}
        </p>

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
