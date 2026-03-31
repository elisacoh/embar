"use client";

import { useState, useEffect } from "react";
import {
  CalendarDays,
  CalendarRange,
  Calendar,
  ListChecks,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { TasksTopNav, type TimeView } from "./TasksTopNav";
import { QuickCreateModal } from "./QuickCreateModal";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { EntityModal } from "@/components/entities/EntityModal";
import { EntityView } from "@/components/entities/EntityView";
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
import type { EntityData, ItemData } from "@/lib/types";

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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [panelInitialItem, setPanelInitialItem] = useState<ItemData | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<EntityData | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // Reset entity selection when scope changes
  useEffect(() => {
    setActiveEntityId(null);
  }, [showAllWorkspaces]);

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
    // Realtime will pick it up if entity matches; also add optimistically
    if (item.entity_id === activeEntityId) {
      setItems((prev) => [...prev, item]);
    }
    setShowQuickCreate(false);
  }

  function handleOpenDetail(item: ItemData) {
    handleItemCreated(item);
    setPanelInitialItem(item);
    setSelectedItemId(item.id);
  }

  function handleSelectItem(id: string) {
    setPanelInitialItem(undefined); // fetch fresh data when clicking from list
    setSelectedItemId(id);
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
          onTimeViewChange={setActiveTimeView}
          entities={entities}
          activeEntityId={activeEntityId}
          onEntityChange={setActiveEntityId}
          onAddEntity={() => setShowEntityModal(true)}
          onRename={handleRename}
          onRecolor={handleRecolor}
          onArchive={handleArchive}
          onDeleteRequest={setDeleteTarget}
          onReorder={handleReorder}
        />

        {/* Action bar */}
        <div className="flex h-9 flex-none items-center justify-end border-b border-border px-4">
          <button
            onClick={() => setShowQuickCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
          >
            <Plus size={12} />
            New task
          </button>
        </div>

        {activeEntity ? (
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
        )}
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

      {/* Overlay — dims content when panel is open */}
      {selectedItemId && (
        <div
          className="fixed inset-0 top-12 z-30 bg-black/20"
          onClick={() => setSelectedItemId(null)}
        />
      )}

      {/* Detail panel — slides in from right */}
      <div
        className={cn(
          "fixed bottom-0 right-0 top-12 z-40 w-[400px] overflow-y-auto border-l border-border bg-background shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          selectedItemId ? "translate-x-0" : "translate-x-full"
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
