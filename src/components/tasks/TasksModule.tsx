"use client";

import { useState, useEffect } from "react";
import {
  CalendarDays,
  CalendarRange,
  Calendar,
  ListChecks,
  Plus,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatViewDate(d: Date): string {
  const str = toLocalDateStr(d);
  const now = new Date();
  if (str === toLocalDateStr(now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (str === toLocalDateStr(yesterday)) return "Yesterday";
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (str === toLocalDateStr(tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
import { TasksTopNav, type TimeView } from "./TasksTopNav";
import { QuickCreateModal } from "./QuickCreateModal";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { SessionDetailPanel } from "./SessionDetailPanel";
import { EntityModal } from "@/components/entities/EntityModal";
import { EntityView } from "@/components/entities/EntityView";
import { TodayView } from "./TodayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { AllView } from "./AllView";
import { SessionCreateModal } from "./SessionCreateModal";
import { SessionView } from "./SessionView";
import { createClient } from "@/lib/supabase/client";
import { useUIStore } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { normalizeItem } from "@/lib/normalize";
import {
  renameEntity,
  recolorEntity,
  archiveEntity,
  deleteEntity,
  reorderEntities,
} from "@/app/actions/entities";
import { updateItem } from "@/app/actions/items";
import { updateSession, getSessionItems, createSessionLightTask } from "@/app/actions/sessions";
import type { EntityData, ItemData, SessionData } from "@/lib/types";

// Module-level cache for session items (stale-while-revalidate)
const sessionItemsCache = new Map<string, ItemData[]>();

const TIME_VIEW_META: Record<
  TimeView,
  { icon: React.ElementType; title: string; description: string }
> = {
  today: {
    icon: CalendarDays,
    title: "Nothing scheduled for today",
    description: "Tasks you focus on today will appear here.",
  },
  week: {
    icon: CalendarRange,
    title: "Nothing scheduled this week",
    description: "Your week is clear. Add tasks to plan it out.",
  },
  month: {
    icon: Calendar,
    title: "Nothing this month",
    description: "All tasks planned for the current month show here.",
  },
  all: {
    icon: ListChecks,
    title: "No tasks yet",
    description: "Create your first task to start tracking your work.",
  },
};

export function TasksModule() {
  const [activeTimeView, setActiveTimeView] = useState<TimeView>("today");
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [entities, setEntities] = useState<EntityData[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showSessionCreate, setShowSessionCreate] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionData | null>(null);
  const [sessionItems, setSessionItems] = useState<ItemData[]>([]);
  const [sessionViewMode, setSessionViewMode] = useState<"list" | "kanban">("list");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [panelInitialItem, setPanelInitialItem] = useState<ItemData | undefined>(undefined);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EntityData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lastCreatedItem, setLastCreatedItem] = useState<ItemData | undefined>(undefined);
  const [showLightTaskCreate, setShowLightTaskCreate] = useState(false);
  const [lightTaskTitle, setLightTaskTitle] = useState("");
  const [lightTaskSaving, setLightTaskSaving] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());

  const activeWorkspaceId = useUIStore((s) => s.activeWorkspaceId);
  const showAllWorkspaces = useUIStore((s) => s.showAllWorkspaces);

  // Cmd/Ctrl+N — open quick create from anywhere in the tasks module
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setShowQuickCreate(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fetch session items when a session becomes active
  useEffect(() => {
    if (!activeSession) {
      setSessionItems([]);
      setSessionViewMode("list");
      return;
    }
    // Show cached data immediately
    const cached = sessionItemsCache.get(activeSession.id);
    if (cached) setSessionItems(cached);

    getSessionItems(activeSession.id).then((result) => {
      if ("items" in result) {
        sessionItemsCache.set(activeSession.id, result.items);
        setSessionItems(result.items);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]); // intentionally omit activeSession — only re-run on id change

  // Keep session items cache in sync so re-opening shows fresh data
  useEffect(() => {
    if (activeSession?.id && sessionItems.length > 0) {
      sessionItemsCache.set(activeSession.id, sessionItems);
    }
  }, [sessionItems, activeSession?.id]);

  // Reset entity selection when scope changes
  useEffect(() => {
    setActiveEntityId(null);
  }, [showAllWorkspaces]);

  // Reset view date when leaving today view
  useEffect(() => {
    if (activeTimeView !== "today") setViewDate(new Date());
  }, [activeTimeView]);

  // Fetch entities
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const supabase = createClient();
    const query = supabase
      .from("entities")
      .select("id, name, color, position, mode")
      .is("deleted_at", null)
      .order("position", { ascending: true });
    if (!showAllWorkspaces) query.eq("workspace_id", activeWorkspaceId);
    query.then(({ data }) => setEntities((data as EntityData[]) ?? []));
  }, [activeWorkspaceId, showAllWorkspaces]);

  // Fetch items for active entity + realtime subscription
  useEffect(() => {
    if (!activeWorkspaceId || !activeEntityId) {
      setItems([]);
      return;
    }

    const supabase = createClient();

    supabase
      .from("items")
      .select(
        "id, workspace_id, entity_id, title, state, scheduled_date, scheduled_time, urgency, created_at"
      )
      .eq("workspace_id", activeWorkspaceId)
      .eq("entity_id", activeEntityId)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .then(({ data }) =>
        setItems((data ?? []).map((r) => normalizeItem(r as Record<string, unknown>)))
      );

    const channel = supabase
      .channel(`items:${activeEntityId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "items",
          filter: `entity_id=eq.${activeEntityId}`,
        },
        (payload) =>
          setItems((prev) => [...prev, normalizeItem(payload.new as Record<string, unknown>)])
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "items",
          filter: `entity_id=eq.${activeEntityId}`,
        },
        (payload) =>
          setItems((prev) =>
            prev.map((it) => (it.id === payload.new.id ? (payload.new as ItemData) : it))
          )
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "items",
          filter: `entity_id=eq.${activeEntityId}`,
        },
        (payload) => setItems((prev) => prev.filter((it) => it.id !== payload.old.id))
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeWorkspaceId, activeEntityId]);

  // ── Entity handlers ──────────────────────────────────────────────────────────

  function handleEntityCreated(entity: EntityData) {
    setEntities((prev) => [...prev, entity]);
    setActiveEntityId(entity.id);
    setShowEntityModal(false);
  }

  function handleRename(id: string, name: string) {
    setEntities((prev) => prev.map((e) => (e.id === id ? { ...e, name } : e)));
    void renameEntity(id, name);
  }

  function handleRecolor(id: string, color: string) {
    setEntities((prev) => prev.map((e) => (e.id === id ? { ...e, color } : e)));
    void recolorEntity(id, color);
  }

  function handleArchive(id: string) {
    setEntities((prev) => prev.filter((e) => e.id !== id));
    if (activeEntityId === id) setActiveEntityId(null);
    void archiveEntity(id);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteEntity(deleteTarget.id);
    setEntities((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    if (activeEntityId === deleteTarget.id) setActiveEntityId(null);
    setDeleteTarget(null);
    setDeleting(false);
  }

  function handleReorder(orderedIds: string[]) {
    setEntities((prev) => {
      const map = new Map(prev.map((e) => [e.id, e]));
      return orderedIds.map((id) => map.get(id)!).filter(Boolean);
    });
    void reorderEntities(orderedIds);
  }

  // ── Item handlers ────────────────────────────────────────────────────────────

  function handleItemCreated(item: ItemData) {
    // Optimistic update for EntityView
    if (item.entity_id === activeEntityId) {
      setItems((prev) => [...prev, item]);
    }
    // Optimistic update for TodayView (which owns its own items state)
    setLastCreatedItem(item);
    setShowQuickCreate(false);
  }

  function handleOpenDetail(item: ItemData) {
    handleItemCreated(item);
    setPanelInitialItem(item);
    setSelectedItemId(item.id);
  }

  function handleSelectItem(id: string) {
    setPanelInitialItem(undefined);
    setSelectedSession(null);
    setSelectedItemId(id);
  }

  function handleSelectSession(session: SessionData) {
    setSelectedItemId(null);
    setSelectedSession((prev) => (prev?.id === session.id ? null : session));
  }

  function handleToggleDone(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newState = item.state === "done" ? "unplanned" : "done";
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, state: newState } : i)));
    void updateItem(id, { state: newState });
  }

  function handleDeleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const activeEntity = entities.find((e) => e.id === activeEntityId) ?? null;
  const { icon: Icon, title, description } = TIME_VIEW_META[activeTimeView];

  return (
    <>
      <div className="flex h-full flex-col">
        <TasksTopNav
          activeTimeView={activeTimeView}
          onTimeViewChange={(v) => {
            setActiveSession(null);
            setActiveTimeView(v);
          }}
          entities={entities}
          activeEntityId={activeEntityId}
          onEntityChange={(id) => {
            setActiveSession(null);
            setActiveEntityId(id);
          }}
          onAddEntity={() => setShowEntityModal(true)}
          onRename={handleRename}
          onRecolor={handleRecolor}
          onArchive={handleArchive}
          onDeleteRequest={setDeleteTarget}
          onReorder={handleReorder}
          activeSession={activeSession}
          onSessionExit={() => setActiveSession(null)}
        />

        {/* Action bar */}
        <div className="flex h-9 flex-none items-center border-b border-border px-4">
          {/* Left spacer / date navigation */}
          {activeTimeView === "today" ? (
            <div className="flex flex-1 items-center justify-center gap-1">
              <button
                onClick={() =>
                  setViewDate((d) => {
                    const n = new Date(d);
                    n.setDate(n.getDate() - 1);
                    return n;
                  })
                }
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={() => setViewDate(new Date())}
                className="min-w-[88px] rounded-md px-2 py-0.5 text-center text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                {formatViewDate(viewDate)}
              </button>
              <button
                onClick={() =>
                  setViewDate((d) => {
                    const n = new Date(d);
                    n.setDate(n.getDate() + 1);
                    return n;
                  })
                }
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center gap-2">
            {activeSession && (
              <div className="flex items-center rounded-lg border border-border p-0.5">
                <button
                  onClick={() => setSessionViewMode("list")}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    sessionViewMode === "list"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  List
                </button>
                <button
                  onClick={() => setSessionViewMode("kanban")}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    sessionViewMode === "kanban"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Kanban
                </button>
              </div>
            )}
            {!activeSession && (
              <button
                onClick={() => setShowSessionCreate(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <Layers size={12} />
                New session
              </button>
            )}
            <button
              onClick={() => setShowQuickCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Plus size={12} />
              New task
            </button>
          </div>
        </div>

        {/* Session kanban — only shown in kanban mode */}
        {activeSession && sessionViewMode === "kanban" && activeWorkspaceId && (
          <div className="h-full">
            <SessionView
              session={activeSession}
              workspaceId={activeWorkspaceId}
              entities={entities}
              onSelectItem={handleSelectItem}
              selectedItemId={selectedItemId}
              onSessionUpdated={(s) => {
                setActiveSession(s);
                // Refresh items after session update
                getSessionItems(s.id).then((r) => {
                  if ("items" in r) {
                    sessionItemsCache.set(s.id, r.items);
                    setSessionItems(r.items);
                  }
                });
              }}
            />
          </div>
        )}

        {/* TodayView — regular mode OR session list mode */}
        {activeWorkspaceId && (
          <div
            className={cn(
              "h-full",
              // hide when: wrong time view (no session), or session is in kanban mode
              activeSession
                ? sessionViewMode !== "list" && "hidden"
                : activeTimeView !== "today" && "hidden"
            )}
          >
            <TodayView
              workspaceId={activeWorkspaceId}
              entityId={activeSession ? null : activeEntityId}
              entities={entities}
              onSelectItem={handleSelectItem}
              selectedItemId={selectedItemId}
              onNewTask={
                activeSession ? () => setShowLightTaskCreate(true) : () => setShowQuickCreate(true)
              }
              onOpenSession={(s) => {
                setSelectedSession(null);
                void updateSession(s.id, { status: "active" });
                setActiveSession({ ...s, status: "active" });
              }}
              onSelectSession={handleSelectSession}
              pendingItem={activeSession ? undefined : lastCreatedItem}
              viewDate={viewDate}
              overrideItems={activeSession ? sessionItems : undefined}
              sessionMode={!!activeSession}
              sessionColumns={activeSession?.columns}
              activeSessionId={activeSession?.id}
              onSessionColumnsChange={(cols) => {
                setActiveSession((prev) => (prev ? { ...prev, columns: cols } : prev));
              }}
            />
          </div>
        )}

        {!activeSession && activeTimeView === "week" && activeWorkspaceId && (
          <WeekView
            workspaceId={activeWorkspaceId}
            entityId={activeEntityId}
            entities={entities}
            onSelectItem={handleSelectItem}
            selectedItemId={selectedItemId}
            onSelectSession={handleSelectSession}
            selectedSessionId={selectedSession?.id ?? null}
          />
        )}

        {!activeSession && activeTimeView === "month" && activeWorkspaceId && (
          <MonthView
            workspaceId={activeWorkspaceId}
            entityId={activeEntityId}
            entities={entities}
            onSelectItem={handleSelectItem}
            selectedItemId={selectedItemId}
            onSelectSession={handleSelectSession}
            selectedSessionId={selectedSession?.id ?? null}
          />
        )}

        {!activeSession && activeTimeView === "all" && activeWorkspaceId && (
          <AllView
            workspaceId={activeWorkspaceId}
            entityId={activeEntityId}
            entities={entities}
            onSelectItem={handleSelectItem}
            selectedItemId={selectedItemId}
          />
        )}

        {!activeSession &&
          activeTimeView !== "today" &&
          activeTimeView !== "week" &&
          activeTimeView !== "month" &&
          activeTimeView !== "all" &&
          (activeEntity ? (
            <EntityView
              entity={activeEntity}
              items={items}
              onNewTask={() => setShowQuickCreate(true)}
              onSelectItem={handleSelectItem}
              onToggleDone={handleToggleDone}
              onDeleteItem={handleDeleteItem}
              selectedItemId={selectedItemId}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center overflow-auto pb-28">
              <div className="flex max-w-xs flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <Icon size={26} strokeWidth={1.5} className="text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <button
                  onClick={() => setShowQuickCreate(true)}
                  className="mt-1 flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
                >
                  <Plus size={13} />
                  New task
                </button>
              </div>
            </div>
          ))}
      </div>

      {showEntityModal && activeWorkspaceId && (
        <EntityModal
          workspaceId={activeWorkspaceId}
          onClose={() => setShowEntityModal(false)}
          onCreated={handleEntityCreated}
        />
      )}

      {showQuickCreate && activeWorkspaceId && (
        <QuickCreateModal
          workspaceId={activeWorkspaceId}
          entities={entities}
          defaultEntityId={activeEntityId}
          onClose={() => setShowQuickCreate(false)}
          onCreated={handleItemCreated}
          onOpenDetail={handleOpenDetail}
        />
      )}

      {showLightTaskCreate && activeSession && activeWorkspaceId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setShowLightTaskCreate(false);
              setLightTaskTitle("");
            }}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl">
            <p className="mb-3 text-sm font-semibold text-foreground">New task</p>
            <input
              autoFocus
              value={lightTaskTitle}
              onChange={(e) => setLightTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!lightTaskTitle.trim() || lightTaskSaving) return;
                  setLightTaskSaving(true);
                  createSessionLightTask({
                    workspaceId: activeWorkspaceId,
                    sessionId: activeSession.id,
                    title: lightTaskTitle.trim(),
                    position: sessionItems.length,
                  }).then((result) => {
                    if ("item" in result) setSessionItems((prev) => [...prev, result.item]);
                    setLightTaskTitle("");
                    setLightTaskSaving(false);
                    setShowLightTaskCreate(false);
                  });
                }
                if (e.key === "Escape") {
                  setShowLightTaskCreate(false);
                  setLightTaskTitle("");
                }
              }}
              placeholder="Task title…"
              className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowLightTaskCreate(false);
                  setLightTaskTitle("");
                }}
                className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={!lightTaskTitle.trim() || lightTaskSaving}
                onClick={() => {
                  if (!lightTaskTitle.trim() || lightTaskSaving) return;
                  setLightTaskSaving(true);
                  createSessionLightTask({
                    workspaceId: activeWorkspaceId,
                    sessionId: activeSession.id,
                    title: lightTaskTitle.trim(),
                    position: sessionItems.length,
                  }).then((result) => {
                    if ("item" in result) setSessionItems((prev) => [...prev, result.item]);
                    setLightTaskTitle("");
                    setLightTaskSaving(false);
                    setShowLightTaskCreate(false);
                  });
                }}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                {lightTaskSaving ? "Adding…" : "Add task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSessionCreate && activeWorkspaceId && (
        <SessionCreateModal
          workspaceId={activeWorkspaceId}
          defaultDate={toLocalDateStr(viewDate)}
          entities={entities}
          onClose={() => setShowSessionCreate(false)}
          onCreated={(session) => {
            setShowSessionCreate(false);
            setActiveSession({ ...session, status: "active" });
            void updateSession(session.id, { status: "active" });
          }}
        />
      )}

      {/* Overlay — dims content when panel is open */}
      {(selectedItemId || selectedSession) && (
        <div
          className="fixed inset-0 top-12 z-30 bg-black/20"
          onClick={() => {
            setSelectedItemId(null);
            setSelectedSession(null);
          }}
        />
      )}

      {/* Detail panel — slides in from right */}
      <div
        className={cn(
          "fixed bottom-0 right-0 top-12 z-40 w-[400px] overflow-y-auto border-l border-border bg-background shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          selectedItemId || selectedSession ? "translate-x-0" : "translate-x-full"
        )}
      >
        {selectedItemId && (
          <TaskDetailPanel
            key={selectedItemId}
            itemId={selectedItemId}
            initialItem={panelInitialItem}
            onClose={() => setSelectedItemId(null)}
            onUpdated={(updated) =>
              setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
            }
          />
        )}
        {selectedSession && (
          <SessionDetailPanel
            key={selectedSession.id}
            session={selectedSession}
            cachedItems={sessionItemsCache.get(selectedSession.id)}
            onClose={() => setSelectedSession(null)}
            onStart={() => {
              const s = selectedSession;
              setSelectedSession(null);
              void updateSession(s.id, { status: "active" });
              setActiveSession({ ...s, status: "active" });
            }}
            onUpdated={(updated) => setSelectedSession(updated)}
            onTaskAdded={(item) => {
              const id = selectedSession.id;
              const cached = sessionItemsCache.get(id) ?? [];
              sessionItemsCache.set(id, [...cached, item]);
              if (activeSession?.id === id) setSessionItems((prev) => [...prev, item]);
            }}
            onItemsFetched={(items) => {
              sessionItemsCache.set(selectedSession.id, items);
              if (activeSession?.id === selectedSession.id) setSessionItems(items);
            }}
          />
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative w-full max-w-xs rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle size={16} className="text-destructive" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Delete &ldquo;{deleteTarget.name}&rdquo;?
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This will delete all tasks in this entity. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete()}
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
