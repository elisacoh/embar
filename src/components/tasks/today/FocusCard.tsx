"use client";

import { useState, useEffect } from "react";
import { Pause, Play, ArrowRight, CheckCircle2, Clock, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItemData, EntityData } from "@/lib/types";
import { timerMs, type TimerState } from "./types";
import { formatElapsed, formatDuration, formatDate, stripHtml } from "./utils";

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

export function FocusCard({
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

      {/* Two-column body */}
      <div className="flex items-stretch px-4 pb-3 pt-3">
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
