"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItemData } from "@/lib/types";
import type { DragTargetProps } from "./types";
import { formatDuration, formatDate } from "./utils";

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

export function TaskCard({
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

      {(isCritical || isUrgent) && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[3px]",
            isCritical ? "bg-destructive" : "bg-amber-400"
          )}
        />
      )}

      <div className={cn("flex items-start gap-2.5 p-2.5", (isCritical || isUrgent) && "pl-4")}>
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

          {item.state === "done" && (item.time_spent_ms > 0 || item.duration_actual) && (
            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground/40">
              {item.time_spent_ms > 0
                ? formatDuration(Math.max(1, Math.round(item.time_spent_ms / 60000)))
                : formatDuration(item.duration_actual!)}
            </p>
          )}

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
