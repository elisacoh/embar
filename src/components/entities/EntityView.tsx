"use client";

import { useState } from "react";
import { ListChecks, LayoutGrid, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteItem } from "@/app/actions/items";
import type { EntityData, ItemData } from "@/lib/types";

interface EntityViewProps {
  entity: EntityData;
  items: ItemData[];
  onNewTask: () => void;
  onSelectItem: (id: string) => void;
  onToggleDone: (id: string) => void;
  onDeleteItem: (id: string) => void;
  selectedItemId: string | null;
}

export function EntityView({
  entity,
  items,
  onNewTask,
  onSelectItem,
  onToggleDone,
  onDeleteItem,
  selectedItemId,
}: EntityViewProps) {
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ItemData | null>(null);
  const [deleting, setDeleting] = useState(false);

  function handleCheckbox(item: ItemData) {
    if (item.state === "done") {
      onToggleDone(item.id);
      return;
    }
    setCompletingIds((prev) => new Set(prev).add(item.id));
    setTimeout(() => {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      onToggleDone(item.id);
    }, 350);
  }

  function handleContextMenu(e: React.MouseEvent, item: ItemData) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ id: item.id, x: e.clientX, y: e.clientY });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    onDeleteItem(deleteTarget.id);
    await deleteItem(deleteTarget.id);
    setDeleteTarget(null);
    setDeleting(false);
  }

  const openCount = items.filter((i) => i.state !== "done").length;
  const urgentCount = items.filter(
    (i) => i.urgency === "urgent" || i.urgency === "critical"
  ).length;
  const waitingCount = items.filter((i) => i.state === "carry-on").length;

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Stats + mode toggle bar */}
        <div className="flex h-10 flex-none items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{openCount}</span> open tasks
            </span>
            <span className="h-3 w-px bg-border" />
            <span>
              <span className="font-semibold text-foreground">{urgentCount}</span> urgent
            </span>
            <span className="h-3 w-px bg-border" />
            <span>
              <span className="font-semibold text-foreground">{waitingCount}</span> waiting
            </span>
          </div>

          {/* Flow / Structure toggle — not functional yet */}
          <div className="flex items-center gap-px rounded-lg border border-border bg-muted p-0.5">
            <ModeButton icon={ListChecks} label="Flow" active={entity.mode !== "structure"} />
            <ModeButton icon={LayoutGrid} label="Structure" active={entity.mode === "structure"} />
          </div>
        </div>

        {/* Content */}
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center overflow-auto pb-28">
            <div className="flex max-w-xs flex-col items-center gap-4 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${entity.color}18` }}
              >
                <ListChecks size={28} strokeWidth={1.5} style={{ color: entity.color }} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No tasks yet</p>
                <p className="text-sm text-muted-foreground">
                  Add your first task to start working on{" "}
                  <span className="font-medium text-foreground">{entity.name}</span>.
                </p>
              </div>
              <button
                onClick={onNewTask}
                className="mt-1 flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: entity.color }}
              >
                <Plus size={13} />
                New task
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pb-28">
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const isDone = item.state === "done";
                const isCompleting = completingIds.has(item.id);
                return (
                  <li
                    key={item.id}
                    onClick={() => onSelectItem(item.id)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-4 py-3 transition-all hover:bg-muted/50",
                      selectedItemId === item.id && "bg-muted/60",
                      isDone && "opacity-50"
                    )}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCheckbox(item);
                      }}
                      className={cn(
                        "flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 transition-all duration-200",
                        isDone || isCompleting
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-muted-foreground/30 hover:border-brand-500"
                      )}
                    >
                      {(isDone || isCompleting) && (
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
                    </button>
                    <span className={cn("flex-1 text-sm", isDone && "line-through")}>
                      {item.title}
                    </span>
                    {item.urgency === "critical" && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                        Critical
                      </span>
                    )}
                    {item.urgency === "urgent" && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        Urgent
                      </span>
                    )}
                    {item.scheduled_date && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.scheduled_date + "T00:00:00").toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Context menu */}
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
            className="fixed z-50 min-w-[160px] overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                const item = items.find((i) => i.id === contextMenu.id);
                if (item) setDeleteTarget(item);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-destructive transition-colors hover:bg-muted"
            >
              <Trash2 size={12} />
              Delete task
            </button>
          </div>
        </>
      )}

      {/* Delete confirmation */}
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

function ModeButton({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <button
      title={label}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
