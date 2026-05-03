"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, GripVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeItem, normalizeSession } from "@/lib/normalize";
import { updateItem, deleteItem } from "@/app/actions/items";
import { updateSession, updateSessionColumns } from "@/app/actions/sessions";
import { cn } from "@/lib/utils";
import type { EntityData, ItemData, SessionData, SessionColumn } from "@/lib/types";

import {
  SECTIONS,
  type SectionState,
  type TimerState,
  type SessionTimerState,
  loadTimer,
  saveTimer,
  timerMs,
  loadSessionTimer,
  saveSessionTimer,
  sessionTimerMs,
} from "./today/types";
import {
  toLocalDateStr,
  TODAY,
  SCHEDULE_START,
  SCHEDULE_END,
  PX_PER_HOUR,
  overdueBadge,
  computeScheduleLayout,
} from "./today/utils";
import { FocusCard } from "./today/FocusCard";
import { FocusSessionCard } from "./today/FocusSessionCard";
import { PlannedCard } from "./today/PlannedCard";
import { SessionCard } from "./today/SessionCard";
import { TaskCard } from "./today/TaskCard";
import { DoneTaskRow, DoneSessionRow } from "./today/DoneRows";
import { UnplannedRow } from "./today/UnplannedRow";
import { SchedulePanel } from "./today/SchedulePanel";
import { ContextMenu } from "./today/ContextMenu";
import { DeleteModal } from "./today/DeleteModal";

// ── Module-level stale-while-revalidate cache ─────────────────────────────────
// Key: `${workspaceId}:${entityId ?? "all"}:${dateStr}`
const todayItemsCache = new Map<string, ItemData[]>();
const todaySessionsCache = new Map<string, SessionData[]>();

// ── Props ─────────────────────────────────────────────────────────────────────

interface TodayViewProps {
  workspaceId: string;
  entityId: string | null;
  entities: EntityData[];
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
  onNewTask: () => void;
  onOpenSession: (session: SessionData) => void;
  onSelectSession?: (session: SessionData) => void;
  pendingItem?: ItemData;
  viewDate?: Date;
  /** When set, skip DB fetch and display these items directly */
  overrideItems?: ItemData[];
  /** In session mode: relax date filters so all session items are visible */
  sessionMode?: boolean;
  /** Session columns — when provided and in session mode, Planned section shows per-column groups */
  sessionColumns?: SessionColumn[];
  /** Session ID — needed to persist column reordering */
  activeSessionId?: string;
  /** Called when user reorders session columns */
  onSessionColumnsChange?: (cols: SessionColumn[]) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TodayView({
  workspaceId,
  entityId,
  entities,
  onSelectItem,
  selectedItemId: _selectedItemId,
  onNewTask,
  onOpenSession,
  onSelectSession,
  pendingItem,
  viewDate: viewDateProp,
  overrideItems,
  sessionMode = false,
  sessionColumns,
  activeSessionId,
  onSessionColumnsChange,
}: TodayViewProps) {
  const viewDate = viewDateProp ?? new Date();
  const viewDateStr = toLocalDateStr(viewDate);
  const isViewingToday = viewDateStr === TODAY;

  // ── Core data ──────────────────────────────────────────────────────────────

  const [items, setItems] = useState<ItemData[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);

  // ── UI state ───────────────────────────────────────────────────────────────

  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [scheduleWidth, setScheduleWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ item: ItemData; x: number; y: number } | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<ItemData | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Tracks where each item was before it entered focus — keyed by item ID
  const [prevFocusStates, setPrevFocusStates] = useState<Map<string, SectionState>>(new Map());

  // ── Selection + drag ───────────────────────────────────────────────────────

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorItemId, setAnchorItemId] = useState<string | null>(null);
  const [dragIds, setDragIds] = useState<Set<string>>(new Set());
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragSessionId, setDragSessionId] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<SectionState | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [dragColId, setDragColId] = useState<string | null>(null);
  const [dragOverColHeaderId, setDragOverColHeaderId] = useState<string | null>(null);

  // ── Timer ──────────────────────────────────────────────────────────────────

  const [timer, setTimerState] = useState<TimerState | null>(null);
  const timerRef = useRef<TimerState | null>(null);
  const [sessionTimer, setSessionTimerState] = useState<SessionTimerState | null>(null);
  const sessionTimerRef = useRef<SessionTimerState | null>(null);

  const scheduleScrollRef = useRef<HTMLDivElement>(null);

  const setTimer = useCallback(
    (t: TimerState | null | ((prev: TimerState | null) => TimerState | null)) => {
      setTimerState((prev) => {
        const next = typeof t === "function" ? t(prev) : t;
        timerRef.current = next;
        saveTimer(next);
        return next;
      });
    },
    []
  );

  const setSessionTimer = useCallback(
    (
      t: SessionTimerState | null | ((prev: SessionTimerState | null) => SessionTimerState | null)
    ) => {
      setSessionTimerState((prev) => {
        const next = typeof t === "function" ? t(prev) : t;
        sessionTimerRef.current = next;
        saveSessionTimer(next);
        return next;
      });
    },
    []
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  // Restore timers from localStorage on mount
  useEffect(() => {
    const saved = loadTimer();
    if (saved) {
      timerRef.current = saved;
      setTimerState(saved);
    }
    const savedSession = loadSessionTimer();
    if (savedSession) {
      sessionTimerRef.current = savedSession;
      setSessionTimerState(savedSession);
    }
  }, []);

  // Pause timer on sign-out
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") pauseTimer();
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync override items (session mode)
  useEffect(() => {
    if (overrideItems !== undefined) setItems(overrideItems);
  }, [overrideItems]);

  // Fetch items + sessions, subscribe to realtime changes
  useEffect(() => {
    if (!workspaceId || overrideItems !== undefined) return;
    const supabase = createClient();
    const cacheKey = `${workspaceId}:${entityId ?? "all"}:${viewDateStr}`;

    // Show cached data immediately (stale-while-revalidate)
    const cachedItems = todayItemsCache.get(cacheKey);
    const cachedSessions = todaySessionsCache.get(cacheKey);
    if (cachedItems) setItems(cachedItems);
    if (cachedSessions) setSessions(cachedSessions);

    let q = supabase
      .from("items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .is("session_origin", null)
      .or(`state.neq.done,completed_at.gte.${viewDateStr}T00:00:00`);

    if (entityId) q = q.eq("entity_id", entityId);

    q.then(({ data }) => {
      const normalized = (data ?? []).map((r) => normalizeItem(r as Record<string, unknown>));
      todayItemsCache.set(cacheKey, normalized);
      setItems(normalized);
    });

    supabase
      .from("sessions")
      .select(
        "id, workspace_id, entity_id, title, type, scheduled_date, scheduled_time, duration_estimate, duration_actual, status, completed_units, total_units, metadata, ai_summary, created_at, deleted_at"
      )
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .eq("scheduled_date", viewDateStr)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const normalized = (data ?? []).map((r) => normalizeSession(r as Record<string, unknown>));
        todaySessionsCache.set(cacheKey, normalized);
        setSessions(normalized);
      });

    const channel = supabase
      .channel(`today:${workspaceId}:${entityId ?? "all"}:${viewDateStr}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "items",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const item = normalizeItem(payload.new as Record<string, unknown>);
          if (item.session_origin === "light") return;
          if (entityId && item.entity_id !== entityId) return;
          if (item.state === "done") return;
          setItems((prev) => (prev.find((i) => i.id === item.id) ? prev : [...prev, item]));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "items",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const updated = normalizeItem(payload.new as Record<string, unknown>);
          setItems((prev) => {
            const exists = prev.some((i) => i.id === updated.id);
            if (updated.state === "done" && !updated.completed_at?.startsWith(viewDateStr)) {
              return prev.filter((i) => i.id !== updated.id);
            }
            return exists
              ? prev.map((i) => (i.id === updated.id ? updated : i))
              : updated.state !== "done"
                ? [...prev, updated]
                : prev;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "items",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => setItems((prev) => prev.filter((i) => i.id !== payload.old.id))
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, entityId, viewDateStr, overrideItems]);

  // Inject freshly-created item (optimistic, before realtime fires)
  useEffect(() => {
    if (!pendingItem || pendingItem.state === "done") return;
    if (entityId && pendingItem.entity_id !== entityId) return;
    setItems((prev) => (prev.find((i) => i.id === pendingItem.id) ? prev : [...prev, pendingItem]));
  }, [pendingItem, entityId]);

  // Scroll to current time when schedule opens
  useEffect(() => {
    if (!scheduleScrollRef.current || !scheduleOpen) return;
    const now = new Date();
    const h = now.getHours();
    if (h < SCHEDULE_START || h >= SCHEDULE_END) return;
    scheduleScrollRef.current.scrollTop = Math.max(0, (h - SCHEDULE_START - 1) * PX_PER_HOUR);
  }, [scheduleOpen]);

  // Auto-start session timer when an active session appears in the focus section
  useEffect(() => {
    if (sessionMode) return;
    const active = sessions.find((s) => s.status === "active");
    if (!active) return;
    setSessionTimer((prev) => {
      if (prev?.sessionId === active.id) return prev;
      // Initialize elapsed from DB value so timer survives page reload
      const banked = (active.duration_actual ?? 0) * 60 * 1000;
      return { sessionId: active.id, elapsed: banked, startedAt: Date.now() };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, sessionMode]);

  // Sync session timer to DB every minute while it's running
  useEffect(() => {
    const id = setInterval(() => {
      const t = sessionTimerRef.current;
      if (!t?.startedAt) return;
      const ms = t.elapsed + (Date.now() - t.startedAt);
      void updateSession(t.sessionId, { duration_actual: Math.max(1, Math.round(ms / 60000)) });
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Escape clears multi-selection
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedIds(new Set());
        setAnchorItemId(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Timer operations ───────────────────────────────────────────────────────

  function startTimerFor(itemId: string) {
    const banked = items.find((i) => i.id === itemId)?.time_spent_ms ?? 0;
    setTimer({ itemId, elapsed: banked, startedAt: Date.now() });
  }

  function pauseTimer() {
    setTimer((prev) => {
      if (!prev?.startedAt) return prev;
      return { ...prev, elapsed: prev.elapsed + (Date.now() - prev.startedAt), startedAt: null };
    });
  }

  function resumeTimer() {
    setTimer((prev) => {
      if (!prev || prev.startedAt) return prev;
      return { ...prev, startedAt: Date.now() };
    });
  }

  function stopTimerAndGetMinutes(saveForLater = false): {
    minutes: number;
    time_spent_ms: number;
  } {
    const t = timerRef.current;
    if (!t) return { minutes: 0, time_spent_ms: 0 };
    const ms = timerMs(t);
    const newMs = saveForLater ? ms : 0;
    setItems((prev) => prev.map((i) => (i.id === t.itemId ? { ...i, time_spent_ms: newMs } : i)));
    setTimer(null);
    return { minutes: Math.max(1, Math.round(ms / 60000)), time_spent_ms: newMs };
  }

  // ── Session timer operations ───────────────────────────────────────────────

  function pauseSessionTimer() {
    setSessionTimer((prev) => {
      if (!prev?.startedAt) return prev;
      const elapsed = prev.elapsed + (Date.now() - prev.startedAt);
      void updateSession(prev.sessionId, {
        duration_actual: Math.max(1, Math.round(elapsed / 60000)),
      });
      return { ...prev, elapsed, startedAt: null };
    });
  }

  function resumeSessionTimer() {
    setSessionTimer((prev) => {
      if (!prev || prev.startedAt) return prev;
      return { ...prev, startedAt: Date.now() };
    });
  }

  function handleSessionDone(session: SessionData) {
    const t = sessionTimerRef.current;
    const ms = t?.sessionId === session.id ? sessionTimerMs(t) : 0;
    const minutes = ms > 0 ? Math.max(1, Math.round(ms / 60000)) : undefined;
    setSessions((prev) =>
      prev.map((s) => (s.id === session.id ? { ...s, status: "completed" as const } : s))
    );
    setSessionTimer(null);
    void updateSession(session.id, {
      status: "completed",
      ...(minutes !== undefined ? { duration_actual: minutes } : {}),
    });
  }

  function handleResetTimer(itemId: string) {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, time_spent_ms: 0 } : i)));
    void updateItem(itemId, { time_spent_ms: 0 });
    if (timer?.itemId === itemId) {
      setTimer({ itemId, elapsed: 0, startedAt: Date.now() });
    }
  }

  // ── Focus actions ──────────────────────────────────────────────────────────

  function handleScheduleItem(id: string, date: string, time: string | null) {
    const updates = { state: "planned" as const, scheduled_date: date, scheduled_time: time };
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    void updateItem(id, updates);
  }

  function setFocusItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || item.state === "focus") return;
    const currentFocus = items.filter((i) => i.state === "focus");
    if (currentFocus.length > 0) {
      autoSwapFocus(id, currentFocus[0]!);
      return;
    }
    setPrevFocusStates((prev) => new Map(prev).set(id, item.state as SectionState));
    startTimerFor(id);
    applyDrop(id, "focus");
  }

  function moveToSomeday(id: string) {
    const updates = { state: "someday" as const, scheduled_date: viewDateStr };
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    void updateItem(id, updates);
  }

  function handleLater(item: ItemData) {
    const { time_spent_ms } = stopTimerAndGetMinutes(true);
    const targetState = prevFocusStates.get(item.id) ?? "unplanned";
    setPrevFocusStates((prev) => {
      const next = new Map(prev);
      next.delete(item.id);
      return next;
    });
    const scheduled_date =
      targetState === "planned" || targetState === "someday"
        ? (item.scheduled_date ?? viewDateStr)
        : null;
    const updates = { state: targetState, scheduled_date, time_spent_ms };
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...updates } : i)));
    void updateItem(item.id, updates);
  }

  function completeItem(id: string, extraUpdates: Record<string, unknown> = {}) {
    const completedAt = new Date().toISOString();
    setCompletingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, state: "done", completed_at: completedAt, ...extraUpdates } : i
        )
      );
      setCompletingIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      void updateItem(id, {
        state: "done",
        completed_at: completedAt,
        ...extraUpdates,
      } as Parameters<typeof updateItem>[1]);
    }, 350);
  }

  function handleFocusDone(item: ItemData) {
    const { minutes, time_spent_ms } = stopTimerAndGetMinutes(false);
    completeItem(item.id, { duration_actual: minutes, time_spent_ms });
  }

  // ── Completion + delete ────────────────────────────────────────────────────

  function handleCheckbox(item: ItemData) {
    completeItem(item.id);
  }

  function handleToggleSubtask(item: ItemData, subtaskId: string) {
    const newSubtasks = item.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, done: !s.done } : s
    );
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, subtasks: newSubtasks } : i)));
    void updateItem(item.id, { subtasks: newSubtasks });
  }

  function handleContextMenu(e: React.MouseEvent, item: ItemData) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ item, x: e.clientX, y: e.clientY });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    if (timer?.itemId === deleteTarget.id) setTimer(null);
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    await deleteItem(deleteTarget.id);
    setDeleteTarget(null);
    setDeleting(false);
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, item: ItemData) {
    const ids = selectedIds.has(item.id) ? new Set(selectedIds) : new Set([item.id]);
    setDragItemId(item.id);
    setDragIds(ids);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDragItemId(null);
    setDragIds(new Set());
    setSelectedIds(new Set());
    setAnchorItemId(null);
    setDragOverSection(null);
    setDragOverHour(null);
    setDragOverItemId(null);
  }

  function handleSectionDragOver(e: React.DragEvent, state: SectionState) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverSection !== state) setDragOverSection(state);
    setDragOverHour(null);
  }

  function handleSectionDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverSection(null);
      setDragOverItemId(null);
    }
  }

  function handleItemDragOver(_e: React.DragEvent, itemId: string) {
    if (dragOverItemId !== itemId) setDragOverItemId(itemId);
  }

  function handleItemDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverItemId(null);
    }
  }

  function clearDragState() {
    setDragItemId(null);
    setDragIds(new Set());
    setDragOverSection(null);
    setDragOverHour(null);
    setDragOverItemId(null);
    setDragSessionId(null);
    setDragOverColId(null);
  }

  function handleItemDropOnColumn(e: React.DragEvent, targetColId: string) {
    e.preventDefault();
    e.stopPropagation();
    const id = dragItemId;
    const allDragIds = dragIds.size > 0 ? dragIds : id ? new Set([id]) : new Set<string>();
    clearDragState();
    if (!id || allDragIds.size === 0) return;
    const targetCol = sessionColumns?.find((c) => c.id === targetColId);
    allDragIds.forEach((did) => {
      const item = items.find((i) => i.id === did);
      if (!item) return;
      const newMeta = targetCol?.is_catchall
        ? Object.fromEntries(
            Object.entries(item.metadata ?? {}).filter(([k]) => k !== "session_col")
          )
        : { ...(item.metadata ?? {}), session_col: targetColId };
      setItems((prev) => prev.map((i) => (i.id === did ? { ...i, metadata: newMeta } : i)));
      void updateItem(did, { metadata: newMeta });
    });
  }

  function handleItemSelect(e: React.MouseEvent, item: ItemData) {
    e.stopPropagation();
    if (e.shiftKey && anchorItemId) {
      const flat = visibleSections.flatMap((s) => s.items);
      const anchorIdx = flat.findIndex((i) => i.id === anchorItemId);
      const clickIdx = flat.findIndex((i) => i.id === item.id);
      if (anchorIdx !== -1 && clickIdx !== -1) {
        const [lo, hi] = anchorIdx <= clickIdx ? [anchorIdx, clickIdx] : [clickIdx, anchorIdx];
        setSelectedIds(new Set(flat.slice(lo, hi + 1).map((i) => i.id)));
      }
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
      setAnchorItemId(item.id);
    } else {
      setSelectedIds(new Set([item.id]));
      setAnchorItemId(item.id);
      onSelectItem(item.id);
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setAnchorItemId(null);
  }

  function applyDrop(
    id: string,
    targetState: SectionState,
    position?: number,
    extra: Partial<Parameters<typeof updateItem>[1]> = {}
  ) {
    const dateUpdates =
      targetState === "planned" || targetState === "someday"
        ? { scheduled_date: viewDateStr }
        : targetState === "unplanned"
          ? { scheduled_date: null }
          : {};
    const updates = {
      state: targetState,
      ...dateUpdates,
      ...(position !== undefined ? { position } : {}),
      ...extra,
    };
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    void updateItem(id, updates);
  }

  function reorderWithinSection(
    draggedId: string,
    sectionState: SectionState,
    insertBeforeId: string | null
  ) {
    const sectionItems = sections.find((s) => s.state === sectionState)?.items ?? [];
    const dragged = sectionItems.find((i) => i.id === draggedId);
    if (!dragged) return;
    const withoutDragged = sectionItems.filter((i) => i.id !== draggedId);
    const insertIdx =
      insertBeforeId !== null ? withoutDragged.findIndex((i) => i.id === insertBeforeId) : -1;
    const finalIdx = insertIdx === -1 ? withoutDragged.length : insertIdx;
    const reordered = [
      ...withoutDragged.slice(0, finalIdx),
      dragged,
      ...withoutDragged.slice(finalIdx),
    ];
    const positionMap = new Map(reordered.map((item, idx) => [item.id, idx]));
    setItems((prev) =>
      prev.map((i) => {
        const newPos = positionMap.get(i.id);
        return newPos !== undefined && newPos !== i.position ? { ...i, position: newPos } : i;
      })
    );
    reordered.forEach((item, idx) => {
      if (item.position !== idx) void updateItem(item.id, { position: idx });
    });
  }

  function reorderMultipleWithinSection(
    draggedIds: string[],
    sectionState: SectionState,
    insertBeforeId: string | null
  ) {
    const sectionItems = sections.find((s) => s.state === sectionState)?.items ?? [];
    const dragSet = new Set(draggedIds);
    const draggedInOrder = sectionItems.filter((i) => dragSet.has(i.id));
    const withoutDragged = sectionItems.filter((i) => !dragSet.has(i.id));
    const insertIdx =
      insertBeforeId !== null ? withoutDragged.findIndex((i) => i.id === insertBeforeId) : -1;
    const finalIdx = insertIdx === -1 ? withoutDragged.length : insertIdx;
    const reordered = [
      ...withoutDragged.slice(0, finalIdx),
      ...draggedInOrder,
      ...withoutDragged.slice(finalIdx),
    ];
    const positionMap = new Map(reordered.map((item, idx) => [item.id, idx]));
    setItems((prev) =>
      prev.map((i) => {
        const newPos = positionMap.get(i.id);
        return newPos !== undefined && newPos !== i.position ? { ...i, position: newPos } : i;
      })
    );
    reordered.forEach((item, idx) => {
      if (item.position !== idx) void updateItem(item.id, { position: idx });
    });
  }

  function handleSectionDrop(e: React.DragEvent, targetState: SectionState) {
    e.preventDefault();

    // Session card dropped onto a section
    if (dragSessionId) {
      const sid = dragSessionId;
      const session = sessions.find((s) => s.id === sid);
      clearDragState();
      if (!session) return;
      if (targetState === "focus") {
        onOpenSession(session);
      } else if (targetState === "planned") {
        // Move active session back to pending — bank elapsed time first
        const t = sessionTimerRef.current;
        const durationActual =
          t?.sessionId === sid ? Math.max(1, Math.round(sessionTimerMs(t) / 60000)) : undefined;
        setSessions((prev) =>
          prev.map((s) => (s.id === sid ? { ...s, status: "pending" as const } : s))
        );
        setSessionTimer(null);
        void updateSession(sid, {
          status: "pending",
          ...(durationActual ? { duration_actual: durationActual } : {}),
        });
      } else if (targetState === "done") {
        handleSessionDone(session);
      } else if (targetState === "unplanned") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = toLocalDateStr(tomorrow);
        const t = sessionTimerRef.current;
        const durationActual =
          t?.sessionId === sid ? Math.max(1, Math.round(sessionTimerMs(t) / 60000)) : undefined;
        setSessions((prev) => prev.filter((s) => s.id !== sid));
        setSessionTimer(null);
        void updateSession(sid, {
          scheduled_date: tomorrowStr,
          ...(durationActual ? { duration_actual: durationActual } : {}),
        });
      }
      return;
    }

    const id = dragItemId;
    const allDragIds = dragIds.size > 0 ? dragIds : id ? new Set([id]) : new Set<string>();
    const insertBeforeId = dragOverItemId;
    clearDragState();
    if (!id || allDragIds.size === 0) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const extra: Partial<Parameters<typeof updateItem>[1]> = {};
    if (item.state === "focus" && targetState !== "focus") {
      const { time_spent_ms } = stopTimerAndGetMinutes(true);
      extra.time_spent_ms = time_spent_ms;
    }

    if (targetState === "done") {
      allDragIds.forEach((did) => completeItem(did));
      return;
    }

    if (targetState === "focus") {
      if (allDragIds.size > 1) return;
      const currentFocus = items.filter((i) => i.state === "focus" && i.id !== id);
      if (currentFocus.length > 0) {
        autoSwapFocus(id, currentFocus[0]!);
        return;
      }
      if (item.state !== "focus") {
        setPrevFocusStates((prev) => new Map(prev).set(id, item.state as SectionState));
        startTimerFor(id);
      }
    }

    if (allDragIds.size === 1) {
      if (item.state === targetState) {
        reorderWithinSection(id, targetState, insertBeforeId);
        return;
      }
      const targetItems = sections.find((s) => s.state === targetState)?.items ?? [];
      applyDrop(id, targetState, targetItems.length, extra);
      return;
    }

    const draggedItems = items.filter((i) => allDragIds.has(i.id));
    if (draggedItems.every((i) => i.state === targetState)) {
      reorderMultipleWithinSection(Array.from(allDragIds), targetState, insertBeforeId);
      return;
    }

    const targetItems = sections.find((s) => s.state === targetState)?.items ?? [];
    const basePosition = targetItems.length;
    draggedItems.forEach((di, idx) => {
      const itemExtra = di.id === id ? extra : {};
      applyDrop(di.id, targetState, basePosition + idx, itemExtra);
    });
  }

  function autoSwapFocus(incomingId: string, currentFocusItem: ItemData) {
    const incomingItem = items.find((i) => i.id === incomingId);
    if (!incomingItem) return;
    const displacedState = prevFocusStates.get(currentFocusItem.id) ?? "planned";
    setPrevFocusStates((prev) => {
      const next = new Map(prev);
      next.set(incomingId, incomingItem.state as SectionState);
      next.delete(currentFocusItem.id);
      return next;
    });
    const { time_spent_ms } = stopTimerAndGetMinutes(true);
    const displaced_date =
      displacedState === "planned" || displacedState === "someday"
        ? (currentFocusItem.scheduled_date ?? viewDateStr)
        : null;
    const displaced = { state: displacedState, scheduled_date: displaced_date, time_spent_ms };
    setItems((prev) =>
      prev.map((i) => (i.id === currentFocusItem.id ? { ...i, ...displaced } : i))
    );
    void updateItem(currentFocusItem.id, displaced);
    startTimerFor(incomingId);
    applyDrop(incomingId, "focus");
  }

  function handleHourDragOver(e: React.DragEvent, hour: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverHour !== hour) setDragOverHour(hour);
    setDragOverSection(null);
  }

  function handleHourDrop(e: React.DragEvent, hour: number) {
    e.preventDefault();

    if (dragSessionId) {
      const sid = dragSessionId;
      clearDragState();
      const h = Math.floor(hour);
      const m = hour !== h ? 30 : 0;
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, scheduled_time: time } : s)));
      void updateSession(sid, { scheduled_time: time });
      return;
    }

    const anchorId = dragItemId;
    const allDragIds =
      dragIds.size > 0 ? dragIds : anchorId ? new Set([anchorId]) : new Set<string>();
    clearDragState();
    if (allDragIds.size === 0) return;
    const h = Math.floor(hour);
    const m = hour !== h ? 30 : 0;
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    allDragIds.forEach((id) => {
      const dragItem = items.find((i) => i.id === id);
      const needsState =
        dragItem && (dragItem.state === "carry-on" || dragItem.state === "unplanned");
      const updates = needsState
        ? { scheduled_time: time, scheduled_date: viewDateStr, state: "planned" as const }
        : { scheduled_time: time, scheduled_date: viewDateStr };
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
      void updateItem(id, updates);
    });
  }

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = scheduleWidth;
    setIsResizing(true);
    function onMouseMove(ev: MouseEvent) {
      const delta = startX - ev.clientX;
      setScheduleWidth(Math.max(160, Math.min(600, startWidth + delta)));
    }
    function onMouseUp() {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const sections = SECTIONS.map((s) => {
    const filtered = items.filter((i) => {
      if (i.state !== s.state) return false;
      if (sessionMode) return true;
      switch (s.state) {
        case "focus":
        case "carry-on":
          return true;
        case "planned":
          return i.scheduled_date === viewDateStr;
        case "unplanned":
          return i.scheduled_date === null || i.scheduled_date === viewDateStr;
        case "someday":
          return i.scheduled_date === viewDateStr;
        case "done":
          return i.completed_at?.startsWith(viewDateStr) ?? false;
      }
    });
    const sortedItems = [...filtered].sort((a, b) => {
      if (s.state === "planned") {
        if (a.scheduled_time && b.scheduled_time)
          return a.scheduled_time.localeCompare(b.scheduled_time);
        if (a.scheduled_time) return -1;
        if (b.scheduled_time) return 1;
      }
      if (a.position !== b.position) return a.position - b.position;
      return a.created_at.localeCompare(b.created_at);
    });
    return { ...s, items: sortedItems };
  });

  const activeSessions = sessionMode ? [] : sessions.filter((s) => s.status === "active");
  const plannedSessions = sessionMode ? [] : sessions.filter((s) => s.status === "pending");
  const doneSessions = sessionMode ? [] : sessions.filter((s) => s.status === "completed");
  const focusItems = sections.find((s) => s.state === "focus")?.items ?? [];

  const ALWAYS_VISIBLE = new Set(
    sessionMode ? ["focus", "planned", "done"] : ["focus", "planned", "unplanned", "done"]
  );
  const visibleSections = sections.filter(
    (s) =>
      ALWAYS_VISIBLE.has(s.state) ||
      s.items.length > 0 ||
      (s.state === "done" && doneSessions.length > 0)
  );

  const scheduledItems = items
    .filter((i) =>
      sessionMode ? !!i.scheduled_time : i.scheduled_date === viewDateStr && !!i.scheduled_time
    )
    .sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? ""));

  const scheduleLayout = computeScheduleLayout(scheduledItems);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className={cn("flex h-full overflow-hidden", isResizing && "select-none")}>
        {/* Task sections */}
        <div className="min-w-0 flex-1 overflow-y-auto" onClick={clearSelection}>
          {visibleSections.map((section) => (
            <div
              key={section.state}
              onDragOver={(e) => handleSectionDragOver(e, section.state)}
              onDragLeave={handleSectionDragLeave}
              onDrop={(e) => handleSectionDrop(e, section.state)}
            >
              {/* Section header */}
              <div
                className={cn(
                  "sticky top-0 z-10 flex items-center gap-2 border-b bg-background/90 px-4 py-2 backdrop-blur-sm",
                  section.state === "carry-on" ? "border-red-500/20 bg-red-500/5" : "border-border"
                )}
              >
                <span className={cn("h-2 w-2 flex-none rounded-full", section.dot)} />
                <span className={cn("text-xs font-semibold", section.color)}>{section.label}</span>
                <span
                  className={cn(
                    "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    section.state === "carry-on"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {section.items.length}
                  {section.state === "carry-on" ? " overdue" : ""}
                </span>
              </div>

              {/* Section content */}
              <div
                className={cn(
                  "min-h-[64px] py-2 transition-colors",
                  dragOverSection === section.state &&
                    (dragItemId || dragSessionId) &&
                    "bg-brand-500/5"
                )}
              >
                {section.state === "focus" ? (
                  section.items.length === 0 && activeSessions.length === 0 ? (
                    <div
                      className={cn(
                        "mx-4 flex w-[min(100%-2rem,480px)] items-center justify-center rounded-2xl border border-dashed py-6 text-xs transition-colors",
                        dragOverSection === "focus" && (dragItemId || dragSessionId)
                          ? "border-brand-400 bg-brand-500/5 text-brand-500"
                          : "border-border text-muted-foreground/40"
                      )}
                    >
                      Drop a task here to focus on it
                    </div>
                  ) : (
                    <>
                      {activeSessions.map((session) => (
                        <FocusSessionCard
                          key={session.id}
                          session={session}
                          timer={sessionTimer?.sessionId === session.id ? sessionTimer : null}
                          isDragging={dragSessionId === session.id}
                          isSelected={false}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            setDragSessionId(session.id);
                          }}
                          onDragEnd={() => setDragSessionId(null)}
                          onSelect={(e) => {
                            e.stopPropagation();
                            onSelectSession?.(session);
                          }}
                          onPause={pauseSessionTimer}
                          onResume={resumeSessionTimer}
                          onContinue={() => onOpenSession(session)}
                          onDone={() => handleSessionDone(session)}
                        />
                      ))}
                      {section.items.map((item) => (
                        <FocusCard
                          key={item.id}
                          item={item}
                          entity={entities.find((e) => e.id === item.entity_id) ?? null}
                          timer={timer?.itemId === item.id ? timer : null}
                          completing={completingIds.has(item.id)}
                          isDragging={dragIds.has(item.id)}
                          isSelected={selectedIds.has(item.id)}
                          onDragStart={(e) => handleDragStart(e, item)}
                          onDragEnd={handleDragEnd}
                          onSelect={(e) => handleItemSelect(e, item)}
                          onPause={pauseTimer}
                          onResume={resumeTimer}
                          onLater={() => handleLater(item)}
                          onDone={() => handleFocusDone(item)}
                          onToggleSubtask={(subtaskId) => handleToggleSubtask(item, subtaskId)}
                          onContextMenu={(e) => handleContextMenu(e, item)}
                        />
                      ))}
                    </>
                  )
                ) : section.state === "planned" ? (
                  plannedSessions.length === 0 && section.items.length === 0 ? (
                    <div
                      className={cn(
                        "mx-4 flex w-[min(100%-2rem,480px)] items-center justify-center rounded-xl border border-dashed py-4 text-xs transition-colors",
                        dragOverSection === "planned" && (dragItemId || dragSessionId)
                          ? "border-brand-400 bg-brand-500/5 text-brand-500"
                          : "border-border text-muted-foreground/40"
                      )}
                    >
                      No tasks planned for today
                    </div>
                  ) : sessionMode && sessionColumns && sessionColumns.length > 0 ? (
                    // Session mode with custom columns — group items by column with drag-and-drop
                    <div className="space-y-4 px-4 pb-2 pt-1">
                      {sessionColumns.map((col) => {
                        const colItems = section.items.filter((item) => {
                          const sc = item.metadata?.session_col as string | undefined;
                          return sc ? sc === col.id : !!col.is_catchall;
                        });
                        const isColDropTarget = dragOverColId === col.id && !!dragItemId;
                        const isHeaderDropTarget =
                          dragOverColHeaderId === col.id && !!dragColId && dragColId !== col.id;
                        return (
                          <div
                            key={col.id}
                            onDragOver={(e) => {
                              if (dragItemId) {
                                e.preventDefault();
                                if (dragOverColId !== col.id) setDragOverColId(col.id);
                              }
                            }}
                            onDragLeave={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node))
                                setDragOverColId(null);
                            }}
                            onDrop={(e) => {
                              if (dragItemId) handleItemDropOnColumn(e, col.id);
                            }}
                            className={cn(
                              "rounded-lg transition-colors",
                              isColDropTarget && "bg-brand-500/5"
                            )}
                          >
                            {/* Draggable column header */}
                            <div
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                setDragColId(col.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragEnd={() => {
                                setDragColId(null);
                                setDragOverColHeaderId(null);
                              }}
                              onDragOver={(e) => {
                                if (dragColId && dragColId !== col.id) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (dragOverColHeaderId !== col.id)
                                    setDragOverColHeaderId(col.id);
                                }
                              }}
                              onDragLeave={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget as Node))
                                  setDragOverColHeaderId(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const fromId = dragColId;
                                setDragColId(null);
                                setDragOverColHeaderId(null);
                                if (
                                  !fromId ||
                                  fromId === col.id ||
                                  !sessionColumns ||
                                  !activeSessionId
                                )
                                  return;
                                const fromIdx = sessionColumns.findIndex((c) => c.id === fromId);
                                const toIdx = sessionColumns.findIndex((c) => c.id === col.id);
                                if (fromIdx === -1 || toIdx === -1) return;
                                const newCols = [...sessionColumns];
                                const [moved] = newCols.splice(fromIdx, 1);
                                newCols.splice(toIdx, 0, moved!);
                                onSessionColumnsChange?.(newCols);
                                void updateSessionColumns(activeSessionId, newCols);
                              }}
                              className={cn(
                                "mb-2 flex cursor-grab items-center gap-1.5 rounded px-1 py-0.5 transition-colors active:cursor-grabbing",
                                isHeaderDropTarget &&
                                  "bg-brand-500/10 outline outline-1 outline-brand-400/50",
                                dragColId === col.id && "opacity-40"
                              )}
                            >
                              <GripVertical size={10} className="text-muted-foreground/30" />
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                                {col.label}
                              </p>
                            </div>

                            {/* Column items */}
                            {colItems.length === 0 ? (
                              <div
                                className={cn(
                                  "flex items-center justify-center rounded-lg border border-dashed py-3 text-[11px] transition-colors",
                                  isColDropTarget
                                    ? "border-brand-400/50 text-brand-500"
                                    : "border-border/40 text-muted-foreground/30"
                                )}
                              >
                                {isColDropTarget ? "Drop here" : "Empty"}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {colItems.map((item) => (
                                  <PlannedCard
                                    key={item.id}
                                    item={item}
                                    entity={entities.find((e) => e.id === item.entity_id) ?? null}
                                    isDragging={dragIds.has(item.id)}
                                    isSelected={selectedIds.has(item.id)}
                                    isDragTarget={
                                      dragOverItemId === item.id && !dragIds.has(item.id)
                                    }
                                    onDragStart={(e) => handleDragStart(e, item)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleItemDragOver(e, item.id)}
                                    onDragLeave={handleItemDragLeave}
                                    onSelect={(e) => handleItemSelect(e, item)}
                                    onFocus={() => setFocusItem(item.id)}
                                    onContextMenu={(e) => handleContextMenu(e, item)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 px-4">
                      {plannedSessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          isDragging={dragSessionId === session.id}
                          isDragTarget={false}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            setDragSessionId(session.id);
                          }}
                          onDragEnd={() => setDragSessionId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onSelect={() => onSelectSession?.(session)}
                          onStart={() => onOpenSession(session)}
                        />
                      ))}
                      {section.items.map((item) => (
                        <PlannedCard
                          key={item.id}
                          item={item}
                          entity={entities.find((e) => e.id === item.entity_id) ?? null}
                          isDragging={dragIds.has(item.id)}
                          isSelected={selectedIds.has(item.id)}
                          isDragTarget={dragOverItemId === item.id && !dragIds.has(item.id)}
                          onDragStart={(e) => handleDragStart(e, item)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleItemDragOver(e, item.id)}
                          onDragLeave={handleItemDragLeave}
                          onSelect={(e) => handleItemSelect(e, item)}
                          onFocus={() => setFocusItem(item.id)}
                          onContextMenu={(e) => handleContextMenu(e, item)}
                        />
                      ))}
                    </div>
                  )
                ) : section.state === "unplanned" ? (
                  section.items.length === 0 ? (
                    <div
                      className={cn(
                        "mx-4 flex w-[min(100%-2rem,480px)] items-center justify-center rounded-xl border border-dashed py-4 text-xs transition-colors",
                        dragOverSection === "unplanned" && (dragItemId || dragSessionId)
                          ? "border-brand-400 bg-brand-500/5 text-brand-500"
                          : "border-border text-muted-foreground/40"
                      )}
                    >
                      Drop tasks here to delay them
                    </div>
                  ) : (
                    <div className="py-1">
                      {section.items.map((item) => (
                        <UnplannedRow
                          key={item.id}
                          item={item}
                          isSelected={selectedIds.has(item.id)}
                          isDragging={dragIds.has(item.id)}
                          isDragTarget={dragOverItemId === item.id && !dragIds.has(item.id)}
                          onDragStart={(e) => handleDragStart(e, item)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleItemDragOver(e, item.id)}
                          onDragLeave={handleItemDragLeave}
                          onSelect={(e) => handleItemSelect(e, item)}
                          onSchedule={(date, time) => handleScheduleItem(item.id, date, time)}
                          onContextMenu={(e) => handleContextMenu(e, item)}
                        />
                      ))}
                    </div>
                  )
                ) : section.state === "carry-on" ? (
                  section.items.length === 0 ? (
                    <div
                      className={cn(
                        "mx-4 flex w-[min(100%-2rem,480px)] items-center justify-center rounded-xl border border-dashed py-4 text-xs transition-colors",
                        dragOverSection === "carry-on" && dragItemId
                          ? "border-red-400 bg-red-500/5 text-red-500"
                          : "border-border text-muted-foreground/40"
                      )}
                    >
                      Drop tasks here
                    </div>
                  ) : (
                    <div className="py-1">
                      {section.items.map((item) => (
                        <UnplannedRow
                          key={item.id}
                          item={item}
                          isSelected={selectedIds.has(item.id)}
                          isDragging={dragIds.has(item.id)}
                          isDragTarget={dragOverItemId === item.id && !dragIds.has(item.id)}
                          overdueBadge={overdueBadge(item.scheduled_date)}
                          onDragStart={(e) => handleDragStart(e, item)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleItemDragOver(e, item.id)}
                          onDragLeave={handleItemDragLeave}
                          onSelect={(e) => handleItemSelect(e, item)}
                          onSchedule={(date, time) => handleScheduleItem(item.id, date, time)}
                          onContextMenu={(e) => handleContextMenu(e, item)}
                        />
                      ))}
                    </div>
                  )
                ) : section.state === "done" ? (
                  doneSessions.length === 0 && section.items.length === 0 ? (
                    <div
                      className={cn(
                        "mx-4 flex w-[min(100%-2rem,480px)] items-center justify-center rounded-xl border border-dashed py-4 text-xs transition-colors",
                        dragOverSection === "done" && (dragItemId || dragSessionId)
                          ? "border-brand-400 bg-brand-500/5 text-brand-500"
                          : "border-border text-muted-foreground/40"
                      )}
                    >
                      Drop tasks here to mark them done
                    </div>
                  ) : (
                    <div className="py-1">
                      {doneSessions.map((session) => (
                        <DoneSessionRow
                          key={session.id}
                          session={session}
                          isDragging={dragSessionId === session.id}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            setDragSessionId(session.id);
                          }}
                          onDragEnd={() => setDragSessionId(null)}
                          onDragOver={(e) => e.preventDefault()}
                        />
                      ))}
                      {section.items.map((item) => (
                        <DoneTaskRow
                          key={item.id}
                          item={item}
                          isDragging={dragIds.has(item.id)}
                          isDragTarget={dragOverItemId === item.id && !dragIds.has(item.id)}
                          onDragStart={(e) => handleDragStart(e, item)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleItemDragOver(e, item.id)}
                          onDragLeave={handleItemDragLeave}
                          onSelect={(e) => handleItemSelect(e, item)}
                          onContextMenu={(e) => handleContextMenu(e, item)}
                        />
                      ))}
                    </div>
                  )
                ) : // Someday and any future sections: TaskCard list
                section.items.length === 0 ? (
                  <div
                    className={cn(
                      "mx-4 flex w-[min(100%-2rem,480px)] items-center justify-center rounded-xl border border-dashed py-4 text-xs transition-colors",
                      dragOverSection === section.state && dragItemId
                        ? "border-brand-400 bg-brand-500/5 text-brand-500"
                        : "border-border text-muted-foreground/40"
                    )}
                  >
                    Drop tasks here
                  </div>
                ) : (
                  section.items.map((item) => (
                    <TaskCard
                      key={item.id}
                      item={item}
                      completing={completingIds.has(item.id)}
                      isDragging={dragIds.has(item.id)}
                      isSelected={selectedIds.has(item.id)}
                      isDragTarget={dragOverItemId === item.id && !dragIds.has(item.id)}
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleItemDragOver(e, item.id)}
                      onDragLeave={handleItemDragLeave}
                      onCheckbox={() => handleCheckbox(item)}
                      onSelect={(e) => handleItemSelect(e, item)}
                      onContextMenu={(e) => handleContextMenu(e, item)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}

          {/* New task shortcut */}
          <div className="mx-4 pb-28 pt-2">
            <button
              onClick={onNewTask}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground/50 transition-colors hover:border-brand-400/50 hover:text-brand-500"
            >
              <Plus size={12} />
              New task
            </button>
          </div>
        </div>

        {/* Schedule panel (includes resize handle) */}
        <SchedulePanel
          sessions={sessions}
          scheduledItems={scheduledItems}
          scheduleLayout={scheduleLayout}
          focusItems={focusItems}
          timer={timer}
          scheduleOpen={scheduleOpen}
          scheduleWidth={scheduleWidth}
          isResizing={isResizing}
          isViewingToday={isViewingToday}
          selectedIds={selectedIds}
          dragIds={dragIds}
          dragItemId={dragItemId}
          dragSessionId={dragSessionId}
          dragOverHour={dragOverHour}
          scheduleScrollRef={scheduleScrollRef}
          onToggleOpen={setScheduleOpen}
          onResizeStart={handleResizeStart}
          onSelectItem={onSelectItem}
          onOpenSession={onOpenSession}
          onDragStartItem={handleDragStart}
          onDragEndItem={handleDragEnd}
          onSessionDragStart={(e, id) => {
            e.dataTransfer.effectAllowed = "move";
            setDragSessionId(id);
          }}
          onSessionDragEnd={() => setDragSessionId(null)}
          onHourDragOver={handleHourDragOver}
          onHourDrop={handleHourDrop}
        />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canSetFocus={contextMenu.item.state !== "focus"}
          canMoveToSomeday={contextMenu.item.state !== "someday"}
          canResetTimer={
            contextMenu.item.state === "focus" || (contextMenu.item.time_spent_ms ?? 0) > 0
          }
          onClose={() => setContextMenu(null)}
          onSetFocus={() => {
            setFocusItem(contextMenu.item.id);
            setContextMenu(null);
          }}
          onEdit={() => {
            onSelectItem(contextMenu.item.id);
            setContextMenu(null);
          }}
          onReschedule={() => {
            onSelectItem(contextMenu.item.id);
            setContextMenu(null);
          }}
          onMoveToSomeday={() => {
            moveToSomeday(contextMenu.item.id);
            setContextMenu(null);
          }}
          onResetTimer={() => {
            handleResetTimer(contextMenu.item.id);
            setContextMenu(null);
          }}
          onDelete={() => {
            setDeleteTarget(contextMenu.item);
            setContextMenu(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteModal
          itemTitle={deleteTarget.title}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </>
  );
}
