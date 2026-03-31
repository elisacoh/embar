"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createItem } from "@/app/actions/items";
import { createClient } from "@/lib/supabase/client";
import { EntityPicker } from "./EntityPicker";
import { cn } from "@/lib/utils";
import type { EntityData, ItemData, Subtask } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const DURATION_PRESETS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
];

const STATES = [
  { value: "focus", label: "Focus" },
  { value: "planned", label: "Planned" },
  { value: "carry-on", label: "Carry-on" },
  { value: "unplanned", label: "Unplanned" },
  { value: "someday", label: "Someday" },
];

const URGENCIES = [
  { value: "critical", label: "🔴 Critical" },
  { value: "urgent", label: "🟡 Urgent" },
  { value: "normal", label: "⚪ Normal" },
];

const WORK_TYPES = [
  { value: "deep", label: "🧠 Deep work" },
  { value: "shallow", label: "💬 Shallow" },
  { value: "admin", label: "📋 Admin" },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// ── Types ─────────────────────────────────────────────────────────────────────

type ActivePicker = "date" | "time" | "duration" | "contact" | "location" | null;

interface Contact {
  id: string;
  name: string;
  email: string | null;
}

interface QuickCreateModalProps {
  workspaceId: string;
  entities: EntityData[];
  defaultEntityId: string | null;
  onClose: () => void;
  onCreated: (item: ItemData) => void;
  onOpenDetail: (item: ItemData) => void;
}

// ── Mini calendar ─────────────────────────────────────────────────────────────

function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const mondayStart = (firstDay.getDay() + 6) % 7; // Mon = 0
  const days: (Date | null)[] = [];
  for (let i = 0; i < mondayStart; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function MiniCalendar({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const today = new Date();
  const initDate = value ? new Date(value + "T00:00:00") : today;
  const [year, setYear] = useState(initDate.getFullYear());
  const [month, setMonth] = useState(initDate.getMonth());

  const todayStr = toDateStr(today);
  const weeks = buildMonthGrid(year, month);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  return (
    <div className="select-none">
      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft size={13} />
        </button>
        <span className="text-xs font-semibold text-foreground">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Day labels */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-[10px] font-medium text-muted-foreground/50">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 text-center">
          {week.map((day, di) => {
            if (!day) return <div key={di} />;
            const str = toDateStr(day);
            const isSelected = str === value;
            const isToday = str === todayStr;
            return (
              <button
                key={di}
                type="button"
                onClick={() => onChange(str)}
                className={cn(
                  "mx-auto my-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors",
                  isSelected
                    ? "bg-brand-500 font-semibold text-white"
                    : isToday
                      ? "font-medium text-brand-600 ring-1 ring-brand-500 hover:bg-brand-500/10"
                      : "text-foreground hover:bg-muted"
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      ))}

      {value && (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 w-full text-center text-[11px] text-muted-foreground hover:text-foreground"
        >
          Clear date
        </button>
      )}
    </div>
  );
}

// ── Property chip ─────────────────────────────────────────────────────────────

function PropChip({
  emoji,
  label,
  active,
  disabled,
  onClick,
  onClear,
}: {
  emoji: string;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  onClear?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all",
        active
          ? "bg-brand-500/8 border-brand-500/30 text-foreground"
          : "border-border text-muted-foreground hover:border-border/80 hover:bg-muted/60 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-30"
      )}
    >
      <span>{emoji}</span>
      <span>{label}</span>
      {active && onClear && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X size={9} />
        </span>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function QuickCreateModal({
  workspaceId,
  entities,
  defaultEntityId,
  onClose,
  onCreated,
  onOpenDetail,
}: QuickCreateModalProps) {
  // Core
  const [title, setTitle] = useState("");
  const [entityId, setEntityId] = useState<string | null>(defaultEntityId);

  // Description
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);

  // Subtasks
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);

  // Property pickers
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [location, setLocation] = useState("");
  const [isFixed, setIsFixed] = useState(false);

  // Always-visible fields
  const [hardDeadline, setHardDeadline] = useState(false);

  // Expanded section
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState("unplanned");
  const [urgency, setUrgency] = useState("normal");
  const [workType, setWorkType] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");

  // Submit
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const subtaskRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!time) setIsFixed(false);
  }, [time]);
  useEffect(() => {
    if (date) setState((prev) => (prev === "unplanned" ? "planned" : prev));
    else setState((prev) => (prev === "planned" ? "unplanned" : prev));
  }, [date]);
  useEffect(() => {
    if (showDescription) setTimeout(() => descRef.current?.focus(), 0);
  }, [showDescription]);
  useEffect(() => {
    if (showSubtaskInput) setTimeout(() => subtaskRef.current?.focus(), 0);
  }, [showSubtaskInput]);

  useEffect(() => {
    if (activePicker !== "contact") return;
    const supabase = createClient();
    supabase
      .from("contacts")
      .select("id, name, email")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .limit(20)
      .then(({ data }) => setContacts((data as Contact[]) ?? []));
  }, [activePicker, workspaceId]);

  function togglePicker(picker: ActivePicker) {
    setActivePicker((prev) => (prev === picker ? null : picker));
  }

  // ── Subtasks ────────────────────────────────────────────────────────────────

  function addSubtask() {
    if (!newSubtaskText.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: newSubtaskText.trim(), done: false },
    ]);
    setNewSubtaskText("");
    subtaskRef.current?.focus();
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function submit(openDetail = false) {
    if (!title.trim() || loading) return;
    setLoading(true);
    setError("");

    const result = await createItem({
      workspaceId,
      title,
      description: description.trim() || null,
      subtasks,
      entityId,
      scheduledDate: date || null,
      scheduledTime: time || null,
      durationEstimate: duration,
      isFixed,
      waitingFor: contactId,
      location: location.trim() || null,
      state,
      urgency,
      workType,
      dueDate: dueDate || null,
      hardDeadline,
    });

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (openDetail) onOpenDetail(result.item);
    else onCreated(result.item);
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const selectedContact = contacts.find((c) => c.id === contactId) ?? null;
  const filteredContacts = contacts.filter(
    (c) =>
      !contactSearch ||
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(contactSearch.toLowerCase())
  );

  function formatDuration(mins: number) {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h${m}m` : `${h}h`;
  }

  function formatDateLabel(d: string) {
    const dt = new Date(d + "T00:00:00");
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d === toDateStr(today)) return "Today";
    if (d === toDateStr(tomorrow)) return "Tomorrow";
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatTimeLabel(t: string) {
    const [h, m] = t.split(":").map(Number);
    const hr = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
    return `${hr}:${String(m ?? 0).padStart(2, "0")} ${(h ?? 0) < 12 ? "am" : "pm"}`;
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <span className="text-sm font-semibold text-foreground">New Task</span>
          <div className="flex items-center gap-2">
            <EntityPicker entities={entities} value={entityId} onChange={setEntityId} />
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="px-6 py-5">
          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            placeholder="Task title"
            className="mb-4 w-full bg-transparent text-xl font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/30"
          />

          {/* Description */}
          {showDescription ? (
            <textarea
              ref={descRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowDescription(false);
              }}
              placeholder="Add a description…"
              rows={3}
              className="mb-4 w-full resize-none rounded-xl bg-muted/40 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:bg-muted/60"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowDescription(true)}
              className="mb-4 text-sm text-muted-foreground/40 transition-colors hover:text-muted-foreground"
            >
              Add description
            </button>
          )}

          {/* Subtask list */}
          {subtasks.length > 0 && (
            <div className="mb-3 space-y-1">
              {subtasks.map((s) => (
                <div key={s.id} className="group flex items-center gap-2.5 rounded-lg px-1 py-1">
                  <div className="h-4 w-4 flex-none rounded-full border-2 border-muted-foreground/25" />
                  <span className="flex-1 text-sm text-foreground">{s.title}</span>
                  <button
                    onClick={() => setSubtasks((prev) => prev.filter((x) => x.id !== s.id))}
                    className="text-muted-foreground/20 opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add subtask */}
          {showSubtaskInput ? (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-muted/40 px-4 py-2.5">
              <Plus size={13} className="flex-none text-muted-foreground/50" />
              <input
                ref={subtaskRef}
                type="text"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtask();
                  }
                  if (e.key === "Escape") setShowSubtaskInput(false);
                }}
                placeholder="Add subtask…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSubtaskInput(true)}
              className="mb-4 text-sm text-muted-foreground/40 transition-colors hover:text-muted-foreground"
            >
              + Add subtask
            </button>
          )}
        </div>

        {/* ── Properties ──────────────────────────────────────────────────── */}
        <div className="border-t border-border/60 px-6 py-4">
          {/* Chip row */}
          <div className="flex flex-wrap gap-2">
            <PropChip
              emoji="📅"
              label={date ? formatDateLabel(date) : "Schedule"}
              active={!!date}
              onClick={() => togglePicker("date")}
              onClear={() => {
                setDate("");
                setTime("");
                setActivePicker(null);
              }}
            />
            <PropChip
              emoji="⏰"
              label={time ? formatTimeLabel(time) : "Time"}
              active={!!time}
              disabled={!date}
              onClick={() => togglePicker("time")}
              onClear={() => {
                setTime("");
                setActivePicker(null);
              }}
            />
            <PropChip
              emoji="⏱"
              label={duration ? formatDuration(duration) : "Duration"}
              active={!!duration}
              onClick={() => togglePicker("duration")}
              onClear={() => {
                setDuration(null);
                setActivePicker(null);
              }}
            />
            <PropChip
              emoji="👤"
              label={selectedContact ? selectedContact.name : "Waiting for"}
              active={!!contactId}
              onClick={() => togglePicker("contact")}
              onClear={() => {
                setContactId(null);
                setActivePicker(null);
              }}
            />
            <PropChip
              emoji="📍"
              label={location || "Location"}
              active={!!location}
              onClick={() => togglePicker("location")}
              onClear={() => {
                setLocation("");
                setActivePicker(null);
              }}
            />
          </div>

          {/* Active pickers */}
          {activePicker === "date" && (
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-4">
              <MiniCalendar
                value={date}
                onChange={(v) => {
                  setDate(v);
                  setActivePicker(null);
                }}
                onClear={() => {
                  setDate("");
                  setTime("");
                  setActivePicker(null);
                }}
              />
            </div>
          )}

          {activePicker === "time" && (
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
              <input
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  if (e.target.value) setActivePicker(null);
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-400"
                autoFocus
              />
            </div>
          )}

          {activePicker === "duration" && (
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setDuration(duration === p.value ? null : p.value);
                      setActivePicker(null);
                    }}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                      duration === p.value
                        ? "bg-brand-500 text-white"
                        : "border border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={duration ?? ""}
                  onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : null)}
                  placeholder="custom min"
                  className="w-28 rounded-full border border-input bg-background px-4 py-1.5 text-xs outline-none focus:border-brand-400"
                />
              </div>
            </div>
          )}

          {activePicker === "contact" && (
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts…"
                autoFocus
                className="mb-2 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-brand-400"
              />
              {filteredContacts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No contacts found</p>
              ) : (
                <div className="space-y-0.5">
                  {filteredContacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setContactId(contactId === c.id ? null : c.id);
                        setActivePicker(null);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted",
                        contactId === c.id && "bg-brand-500/10 font-medium text-brand-600"
                      )}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold uppercase">
                        {c.name[0]}
                      </span>
                      <span>{c.name}</span>
                      {c.email && <span className="text-muted-foreground">{c.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activePicker === "location" && (
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add a location…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") setActivePicker(null);
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
            </div>
          )}

          {/* Task / Event toggle */}
          {date && time && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
              <span>Looks like an event</span>
              <button
                type="button"
                onClick={() => setIsFixed((f) => !f)}
                className={cn(
                  "ml-auto rounded-full px-3 py-1 font-medium transition-colors",
                  isFixed ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground"
                )}
              >
                {isFixed ? "Event" : "Task"}
              </button>
            </div>
          )}

          {/* Hard deadline — always visible */}
          <button
            type="button"
            onClick={() => setHardDeadline((h) => !h)}
            className={cn(
              "mt-3 flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors",
              hardDeadline
                ? "bg-destructive/8 text-destructive"
                : "text-muted-foreground/60 hover:bg-muted/40 hover:text-muted-foreground"
            )}
          >
            <span className="text-base leading-none">{hardDeadline ? "🔒" : "🔓"}</span>
            <span className="flex-1 text-left text-xs">
              {hardDeadline ? "Hard deadline — AI won't reschedule" : "Hard deadline"}
            </span>
            <span
              className={cn(
                "font-mono text-xs",
                hardDeadline ? "text-destructive" : "text-muted-foreground/30"
              )}
            >
              {hardDeadline ? "ON" : "OFF"}
            </span>
          </button>

          {/* Expanded fields */}
          {expanded && (
            <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted/20 p-4">
              <InlineSelect
                label="State"
                emoji="🎯"
                options={STATES}
                value={state}
                onChange={setState}
              />
              <InlineSelect
                label="Urgency"
                emoji="⚡"
                options={URGENCIES}
                value={urgency}
                onChange={setUrgency}
              />
              <InlineSelect
                label="Work type"
                emoji="🧩"
                options={WORK_TYPES}
                value={workType ?? ""}
                onChange={(v) => setWorkType(v || null)}
              />
              <div className="flex items-center gap-3">
                <span className="text-sm">📆</span>
                <span className="w-20 flex-none text-xs text-muted-foreground">Due date</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-border/60 px-6 py-4">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? "Fewer options" : "More options"}
          </button>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={!title.trim() || loading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-30"
            >
              <ExternalLink size={11} />
              Open detail
            </button>
            <button
              type="button"
              onClick={() => void submit(false)}
              disabled={!title.trim() || loading}
              className="rounded-xl bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function InlineSelect({
  label,
  emoji,
  options,
  value,
  onChange,
}: {
  label: string;
  emoji: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm">{emoji}</span>
      <span className="w-20 flex-none text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand-400"
      >
        {!options.find((o) => o.value === "") && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
