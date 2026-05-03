"use client";

import { Play as PlayIcon, Pencil, Calendar, MoveRight, RotateCcw, Trash2 } from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  canSetFocus: boolean;
  canMoveToSomeday: boolean;
  canResetTimer: boolean;
  onClose: () => void;
  onSetFocus: () => void;
  onEdit: () => void;
  onReschedule: () => void;
  onMoveToSomeday: () => void;
  onResetTimer: () => void;
  onDelete: () => void;
}

export function ContextMenu({
  x,
  y,
  canSetFocus,
  canMoveToSomeday,
  canResetTimer,
  onClose,
  onSetFocus,
  onEdit,
  onReschedule,
  onMoveToSomeday,
  onResetTimer,
  onDelete,
}: ContextMenuProps) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-50 min-w-[180px] overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg"
        style={{ left: x, top: y }}
      >
        {canSetFocus && (
          <button
            onClick={onSetFocus}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <PlayIcon size={12} className="text-brand-500" />
            Set as focus
          </button>
        )}
        <button
          onClick={onEdit}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Pencil size={12} className="text-muted-foreground" />
          Edit
        </button>
        <button
          onClick={onReschedule}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Calendar size={12} className="text-muted-foreground" />
          Reschedule
        </button>
        {canMoveToSomeday && (
          <button
            onClick={onMoveToSomeday}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <MoveRight size={12} className="text-muted-foreground" />
            Move to someday
          </button>
        )}
        {canResetTimer && (
          <button
            onClick={onResetTimer}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RotateCcw size={12} className="text-muted-foreground" />
            Reset timer
          </button>
        )}
        <div className="my-1 border-t border-border" />
        <button
          onClick={onDelete}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-muted"
        >
          <Trash2 size={12} />
          Delete task
        </button>
      </div>
    </>
  );
}
