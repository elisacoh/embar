"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Timer,
  User,
  MapPin,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { createItem } from "@/app/actions/items";
import { createClient } from "@/lib/supabase/client";
import { EntityPicker } from "./EntityPicker";
import { cn } from "@/lib/utils";
import type { EntityData, ItemData, Subtask } from "@/lib/types";

// ── Duration presets ─────────────────────────────────────────────────────────

const DURATION_PRESETS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
];

// ── Expanded field options ────────────────────────────────────────────────────

const STATES = [
  { value: "focus", label: "Focus" },
  { value: "planned", label: "Planned" },
  { value: "carry-on", label: "Carry-on" },
  { value: "unplanned", label: "Unplanned" },
  { value: "someday", label: "Someday" },
];

const URGENCIES = [
  { value: "critical", label: "Critical" },
  { value: "urgent", label: "Urgent" },
  { value: "normal", label: "Normal" },
];

const WORK_TYPES = [
  { value: "deep", label: "Deep work" },
  { value: "shallow", label: "Shallow" },
  { value: "admin", label: "Admin" },
];

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

// ── Icon button ───────────────────────────────────────────────────────────────

function IconBtn({
  icon: Icon,
  active,
  disabled,
  onClick,
  title,
}: {
  icon: React.ElementType;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
        active
          ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "cursor-not-allowed opacity-30"
      )}
    >
      <Icon size={14} />
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

  // Expandable inline sections
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [showSubtasks, setShowSubtasks] = useState(false);

  // Pickers
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [location, setLocation] = useState("");

  // Task/Event
  const [isFixed, setIsFixed] = useState(false);

  // Expanded fields
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState("unplanned");
  const [urgency, setUrgency] = useState("normal");
  const [workType, setWorkType] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [hardDeadline, setHardDeadline] = useState(false);

  // Submit state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const subtaskRef = useRef<HTMLInputElement>(null);

  // Autofocus title
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // When time is cleared, unset isFixed
  useEffect(() => {
    if (!time) setIsFixed(false);
  }, [time]);

  // Auto-set state based on date: unplanned ↔ planned
  useEffect(() => {
    if (date) {
      setState((prev) => (prev === "unplanned" ? "planned" : prev));
    } else {
      setState((prev) => (prev === "planned" ? "unplanned" : prev));
    }
  }, [date]);

  // Auto-focus description when expanded
  useEffect(() => {
    if (showDescription) setTimeout(() => descRef.current?.focus(), 0);
  }, [showDescription]);

  // Auto-focus subtask input when expanded
  useEffect(() => {
    if (showSubtasks) setTimeout(() => subtaskRef.current?.focus(), 0);
  }, [showSubtasks]);

  // Fetch contacts when contact picker opens
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

  // ── Subtask helpers ─────────────────────────────────────────────────────────

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

  // ── Keyboard ────────────────────────────────────────────────────────────────

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

  // ── Derived ─────────────────────────────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X size={14} />
        </button>

        <div className="p-5">
          {/* ── Title ─────────────────────────────────────────────────────── */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            placeholder="What needs to be done?"
            className="mb-3 w-full bg-transparent text-base font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
          />

          {/* ── Inline expandable: description ─────────────────────────── */}
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
              className="mb-2 w-full resize-none rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:bg-muted"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowDescription(true)}
              className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground"
            >
              <span className="text-[10px]">↳</span> Add description
            </button>
          )}

          {/* ── Inline expandable: subtasks ─────────────────────────────── */}
          {showSubtasks ? (
            <div className="mb-3">
              {subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2 py-1">
                  <div className="h-3.5 w-3.5 flex-none rounded-full border-2 border-muted-foreground/30" />
                  <span className="flex-1 text-sm text-foreground">{s.title}</span>
                  <button
                    onClick={() => setSubtasks((prev) => prev.filter((x) => x.id !== s.id))}
                    className="text-muted-foreground/30 hover:text-destructive"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 py-1">
                <Plus size={12} className="flex-none text-muted-foreground" />
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
                    if (e.key === "Escape") setShowSubtasks(false);
                  }}
                  placeholder="Add subtask…"
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSubtasks(true)}
              className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground"
            >
              <span className="text-[10px]">↳</span> Add subtask
            </button>
          )}

          {/* ── Entity picker ─────────────────────────────────────────────── */}
          <div className="mb-4">
            <EntityPicker entities={entities} value={entityId} onChange={setEntityId} />
          </div>

          {/* ── Icon row + active inline picker ─────────────────────────── */}
          <div className="mb-1 flex items-center gap-1">
            <IconBtn
              icon={Calendar}
              active={!!date}
              title="Schedule date"
              onClick={() => togglePicker("date")}
            />
            <IconBtn
              icon={Clock}
              active={!!time}
              disabled={!date}
              title={date ? "Schedule time" : "Set a date first"}
              onClick={() => togglePicker("time")}
            />
            <IconBtn
              icon={Timer}
              active={!!duration}
              title="Duration"
              onClick={() => togglePicker("duration")}
            />
            <IconBtn
              icon={User}
              active={!!contactId}
              title="Waiting for contact"
              onClick={() => togglePicker("contact")}
            />
            <IconBtn
              icon={MapPin}
              active={!!location}
              title="Location"
              onClick={() => togglePicker("location")}
            />
          </div>

          {/* Active picker */}
          {activePicker === "date" && (
            <div className="mb-3 rounded-xl border border-border bg-muted/40 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Date
              </p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-400"
                autoFocus
              />
              {date && (
                <button
                  onClick={() => {
                    setDate("");
                    setTime("");
                    setActivePicker(null);
                  }}
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {activePicker === "time" && (
            <div className="mb-3 rounded-xl border border-border bg-muted/40 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Time
              </p>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-400"
                autoFocus
              />
              {time && (
                <button
                  onClick={() => {
                    setTime("");
                    setActivePicker(null);
                  }}
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {activePicker === "duration" && (
            <div className="mb-3 rounded-xl border border-border bg-muted/40 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Duration
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setDuration(duration === p.value ? null : p.value);
                      setActivePicker(null);
                    }}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
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
                  className="w-24 rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-brand-400"
                />
              </div>
            </div>
          )}

          {activePicker === "contact" && (
            <div className="mb-3 rounded-xl border border-border bg-muted/40 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Waiting for
              </p>
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
            <div className="mb-3 rounded-xl border border-border bg-muted/40 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Location
              </p>
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

          {/* ── Active meta badges row ────────────────────────────────── */}
          {(date || time || duration || contactId || location) && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {date && (
                <Badge
                  label={new Date(date + "T00:00:00").toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  onClear={() => {
                    setDate("");
                    setTime("");
                  }}
                />
              )}
              {time && <Badge label={time} onClear={() => setTime("")} />}
              {duration && (
                <Badge label={formatDuration(duration)} onClear={() => setDuration(null)} />
              )}
              {selectedContact && (
                <Badge label={selectedContact.name} onClear={() => setContactId(null)} />
              )}
              {location && <Badge label={location} onClear={() => setLocation("")} />}
            </div>
          )}

          {/* ── Task / Event toggle when date + time ─────────────────── */}
          {date && time && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span>Looks like an event</span>
              <button
                type="button"
                onClick={() => setIsFixed((f) => !f)}
                className={cn(
                  "ml-auto flex items-center gap-2 rounded-full px-2.5 py-1 font-medium transition-colors",
                  isFixed ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground"
                )}
              >
                {isFixed ? "Event" : "Task"}
              </button>
            </div>
          )}

          {/* ── Expanded fields ───────────────────────────────────────── */}
          {expanded && (
            <div className="mb-4 space-y-3 rounded-xl border border-border bg-muted/20 p-3">
              <InlineSelect label="State" options={STATES} value={state} onChange={setState} />
              <InlineSelect
                label="Urgency"
                options={URGENCIES}
                value={urgency}
                onChange={setUrgency}
              />
              <InlineSelect
                label="Work type"
                options={WORK_TYPES}
                value={workType ?? ""}
                onChange={(v) => setWorkType(v || null)}
              />
              <div className="flex items-start gap-3">
                <span className="w-20 flex-none pt-1.5 text-xs text-muted-foreground">
                  Due date
                </span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand-400"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="w-20 flex-none text-xs text-muted-foreground">Hard deadline</span>
                <button
                  type="button"
                  onClick={() => setHardDeadline((h) => !h)}
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors",
                    hardDeadline ? "bg-destructive" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                      hardDeadline ? "left-4" : "left-0.5"
                    )}
                  />
                </button>
                {hardDeadline && (
                  <span className="text-xs text-destructive">AI won&apos;t reschedule</span>
                )}
              </div>
            </div>
          )}

          {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

          {/* ── Footer ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? "Fewer options" : "See all options"}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void submit(true)}
                disabled={!title.trim() || loading}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                <ExternalLink size={11} />
                Open full detail
              </button>
              <button
                type="button"
                onClick={() => void submit(false)}
                disabled={!title.trim() || loading}
                className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {loading ? "Creating…" : "Create ↵"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Badge({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
      {label}
      <button onClick={onClear} className="text-muted-foreground hover:text-foreground">
        <X size={10} />
      </button>
    </span>
  );
}

function InlineSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
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
