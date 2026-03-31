"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Calendar,
  Clock,
  AlarmClock,
  AlertTriangle,
  Bold,
  Italic,
  List,
  Plus,
  GripVertical,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { getItem, updateItem } from "@/app/actions/items";
import { cn } from "@/lib/utils";
import type { ItemData, Subtask } from "@/lib/types";

// ── Metadata config ──────────────────────────────────────────────────────────

const STATES: { value: string; label: string; color: string }[] = [
  { value: "focus", label: "Focus", color: "bg-brand-500 text-white" },
  { value: "planned", label: "Planned", color: "bg-blue-500 text-white" },
  { value: "carry-on", label: "Carry-on", color: "bg-amber-500 text-white" },
  { value: "unplanned", label: "Unplanned", color: "bg-muted text-muted-foreground" },
  { value: "someday", label: "Someday", color: "bg-purple-500 text-white" },
  { value: "done", label: "Done", color: "bg-green-500 text-white" },
];

const URGENCIES: { value: string; label: string; color: string }[] = [
  { value: "critical", label: "Critical", color: "bg-destructive text-white" },
  { value: "urgent", label: "Urgent", color: "bg-amber-500 text-white" },
  { value: "normal", label: "Normal", color: "bg-muted text-muted-foreground" },
];

const WORK_TYPES: { value: string; label: string; color: string }[] = [
  { value: "deep", label: "Deep work", color: "bg-indigo-500 text-white" },
  { value: "shallow", label: "Shallow", color: "bg-sky-500 text-white" },
  { value: "admin", label: "Admin", color: "bg-muted text-muted-foreground" },
];

const DURATION_PRESETS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
];

// ── Small inline dropdown ────────────────────────────────────────────────────

function PillDropdown({
  options,
  value,
  onChange,
  placeholder = "—",
}: {
  options: { value: string; label: string; color: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
          current ? current.color : "bg-muted text-muted-foreground"
        )}
      >
        {current?.label ?? placeholder}
        <ChevronDown size={10} className="opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[130px] overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg">
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted",
                  value === o.value && "font-semibold"
                )}
              >
                <span className={cn("h-2 w-2 flex-none rounded-full", o.color.split(" ")[0])} />
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Rich text toolbar ────────────────────────────────────────────────────────

function RichToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  function exec(command: string) {
    editorRef.current?.focus();
    document.execCommand(command, false);
  }
  return (
    <div className="flex items-center gap-0.5 border-b border-border px-2 py-1">
      <ToolBtn icon={Bold} onClick={() => exec("bold")} title="Bold (Ctrl+B)" />
      <ToolBtn icon={Italic} onClick={() => exec("italic")} title="Italic (Ctrl+I)" />
      <ToolBtn icon={List} onClick={() => exec("insertUnorderedList")} title="Bullet list" />
    </div>
  );
}

function ToolBtn({
  icon: Icon,
  onClick,
  title,
}: {
  icon: React.ElementType;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon size={12} />
    </button>
  );
}

// ── Row wrapper ──────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-24 flex-none pt-0.5 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

interface TaskDetailPanelProps {
  itemId: string;
  initialItem?: ItemData; // skip fetch when available (e.g. just created)
  onClose: () => void;
  onUpdated?: (item: ItemData) => void;
}

export function TaskDetailPanel({ itemId, initialItem, onClose, onUpdated }: TaskDetailPanelProps) {
  const [draft, setDraft] = useState<ItemData | null>(initialItem ?? null);
  const [loading, setLoading] = useState(!initialItem);

  // Subtask local state
  const [newSubtask, setNewSubtask] = useState("");
  const [subtaskDragSrc, setSubtaskDragSrc] = useState<number | null>(null);
  const [subtaskDragOver, setSubtaskDragOver] = useState<number | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<Record<string, unknown>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const newSubtaskRef = useRef<HTMLInputElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (initialItem) {
      // Already have the item — just set editor content
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = initialItem.description ?? "";
        }
      });
      return;
    }
    setLoading(true);
    getItem(itemId).then((result) => {
      if ("item" in result) {
        setDraft(result.item);
        requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.innerHTML = result.item.description ?? "";
          }
        });
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // ── Escape key ────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // ── Cleanup timer on unmount ───────────────────────────────────────────────

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // ── Auto-save (500ms debounce, batches multiple field changes) ─────────────

  const scheduleSave = useCallback(
    (updates: Record<string, unknown>) => {
      pendingRef.current = { ...pendingRef.current, ...updates };
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const toSave = pendingRef.current;
        pendingRef.current = {};
        void updateItem(itemId, toSave as Parameters<typeof updateItem>[1]);
      }, 500);
    },
    [itemId]
  );

  function patch(updates: Partial<ItemData>) {
    const next = draft ? { ...draft, ...updates } : null;
    setDraft(next);
    if (next) onUpdated?.(next); // immediate card update
    scheduleSave(updates as Record<string, unknown>);
  }

  // ── Subtask helpers ────────────────────────────────────────────────────────

  function addSubtask() {
    if (!newSubtask.trim() || !draft) return;
    const subtask: Subtask = { id: crypto.randomUUID(), title: newSubtask.trim(), done: false };
    const updated = [...(draft.subtasks ?? []), subtask];
    patch({ subtasks: updated });
    setNewSubtask("");
    newSubtaskRef.current?.focus();
  }

  function toggleSubtask(id: string) {
    if (!draft) return;
    patch({ subtasks: draft.subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) });
  }

  function deleteSubtask(id: string) {
    if (!draft) return;
    patch({ subtasks: draft.subtasks.filter((s) => s.id !== id) });
  }

  function handleSubtaskDrop(targetIndex: number) {
    if (subtaskDragSrc === null || subtaskDragSrc === targetIndex || !draft) {
      setSubtaskDragSrc(null);
      setSubtaskDragOver(null);
      return;
    }
    const reordered = [...draft.subtasks];
    const [moved] = reordered.splice(subtaskDragSrc, 1);
    reordered.splice(targetIndex, 0, moved!);
    patch({ subtasks: reordered });
    setSubtaskDragSrc(null);
    setSubtaskDragOver(null);
  }

  // ── Description helpers ───────────────────────────────────────────────────

  function handleEditorInput() {
    const html = editorRef.current?.innerHTML ?? "";
    scheduleSave({ description: html === "<br>" ? null : html });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading || !draft) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-brand-500" />
      </div>
    );
  }

  const durationMinutes = draft.duration_estimate;

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-none items-start gap-2 border-b border-border px-4 py-3">
        <input
          type="text"
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          className="flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
          placeholder="Task title"
        />
        <button
          onClick={onClose}
          className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Body (scrollable) ───────────────────────────────────────────── */}
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {/* Meta pills */}
        <div className="flex flex-wrap gap-2">
          <PillDropdown
            options={STATES}
            value={draft.state}
            onChange={(v) => patch({ state: v ?? "unplanned" })}
          />
          <PillDropdown
            options={URGENCIES}
            value={draft.urgency}
            onChange={(v) => patch({ urgency: v ?? "normal" })}
          />
          <PillDropdown
            options={WORK_TYPES}
            value={draft.work_type}
            onChange={(v) => patch({ work_type: v })}
            placeholder="Work type"
          />
        </div>

        {/* ── Scheduling ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Scheduling
          </p>

          <FieldRow label="Scheduled">
            <div className="flex items-center gap-2">
              <DateInput
                icon={Calendar}
                value={draft.scheduled_date ?? ""}
                onChange={(v) => patch({ scheduled_date: v || null })}
                placeholder="Date"
              />
              <DateInput
                icon={Clock}
                value={draft.scheduled_time ?? ""}
                onChange={(v) => patch({ scheduled_time: v || null })}
                placeholder="Time"
                type="time"
              />
            </div>
          </FieldRow>

          <FieldRow label="Duration">
            <div className="flex flex-wrap items-center gap-1.5">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() =>
                    patch({ duration_estimate: durationMinutes === p.value ? null : p.value })
                  }
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    durationMinutes === p.value
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
              <input
                type="number"
                min={1}
                value={durationMinutes ?? ""}
                onChange={(e) =>
                  patch({ duration_estimate: e.target.value ? Number(e.target.value) : null })
                }
                placeholder="min"
                className="w-14 rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus:border-brand-400"
              />
            </div>
          </FieldRow>

          <FieldRow label="Due date">
            <DateInput
              icon={AlarmClock}
              value={draft.due_date ?? ""}
              onChange={(v) => patch({ due_date: v || null })}
              placeholder="Due date"
            />
          </FieldRow>

          <FieldRow label="Hard deadline">
            <div className="flex items-center gap-2">
              <button
                onClick={() => patch({ hard_deadline: !draft.hard_deadline })}
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  draft.hard_deadline ? "bg-destructive" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    draft.hard_deadline ? "left-4" : "left-0.5"
                  )}
                />
              </button>
              {draft.hard_deadline && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle size={11} />
                  AI will never reschedule this task
                </span>
              )}
            </div>
          </FieldRow>
        </div>

        {/* ── Description ────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Description
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <RichToolbar editorRef={editorRef} />
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              data-placeholder="Add notes, links, context…"
              className={cn(
                "min-h-[100px] px-3 py-2 text-sm text-foreground outline-none",
                "[&:empty:before]:text-muted-foreground/50 [&:empty:before]:content-[attr(data-placeholder)]"
              )}
            />
          </div>
        </div>

        {/* ── Subtasks ────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Subtasks
          </p>

          <ul className="space-y-1">
            {draft.subtasks.map((subtask, i) => (
              <li
                key={subtask.id}
                draggable
                onDragStart={() => setSubtaskDragSrc(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSubtaskDragOver(i);
                }}
                onDragEnd={() => {
                  setSubtaskDragSrc(null);
                  setSubtaskDragOver(null);
                }}
                onDrop={() => handleSubtaskDrop(i)}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted",
                  subtaskDragOver === i && "opacity-50"
                )}
              >
                <GripVertical
                  size={12}
                  className="flex-none cursor-grab text-muted-foreground/30 opacity-0 group-hover:opacity-100"
                />
                <button
                  onClick={() => toggleSubtask(subtask.id)}
                  className={cn(
                    "flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 transition-colors",
                    subtask.done
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-muted-foreground/30 hover:border-brand-500"
                  )}
                >
                  {subtask.done && (
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
                <span
                  className={cn(
                    "flex-1 text-sm",
                    subtask.done && "text-muted-foreground line-through"
                  )}
                >
                  {subtask.title}
                </span>
                <button
                  onClick={() => deleteSubtask(subtask.id)}
                  className="flex-none text-muted-foreground/0 transition-colors hover:!text-destructive group-hover:text-muted-foreground/40"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <Plus size={12} className="flex-none text-muted-foreground" />
            <input
              ref={newSubtaskRef}
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubtask();
                }
              }}
              placeholder="Add subtask…"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* ── Activity ─────────────────────────────────────────────────────── */}
        <div className="space-y-2 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Activity
          </p>
          <p className="text-xs text-muted-foreground">
            Created{" "}
            {new Date(draft.created_at).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Date/time input helper ───────────────────────────────────────────────────

function DateInput({
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = "date",
}: {
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: "date" | "time";
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => ref.current?.showPicker?.()}
      className={cn(
        "relative flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
        value
          ? "border-transparent bg-muted text-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon size={11} />
      {value
        ? type === "date"
          ? new Date(value + "T00:00:00").toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : value
        : placeholder}
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        tabIndex={-1}
      />
    </button>
  );
}
