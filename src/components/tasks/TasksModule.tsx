"use client";

import { useState, useEffect } from "react";
import { CalendarDays, CalendarRange, Calendar, ListChecks, Plus } from "lucide-react";
import { TasksTopNav, type TimeView } from "./TasksTopNav";
import { EntityModal } from "@/components/entities/EntityModal";
import { createClient } from "@/lib/supabase/client";
import { useUIStore } from "@/stores/ui";
import type { EntityData } from "@/lib/types";

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
  const [showEntityModal, setShowEntityModal] = useState(false);

  const activeWorkspaceId = useUIStore((s) => s.activeWorkspaceId);

  // Fetch entities — always scoped to active workspace
  useEffect(() => {
    if (!activeWorkspaceId) return;

    const supabase = createClient();
    supabase
      .from("entities")
      .select("id, name, color, position, mode")
      .eq("workspace_id", activeWorkspaceId)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .then(({ data }) => setEntities((data as EntityData[]) ?? []));
  }, [activeWorkspaceId]);

  function handleEntityCreated(entity: EntityData) {
    setEntities((prev) => [...prev, entity]);
    setActiveEntityId(entity.id);
    setShowEntityModal(false);
  }

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
        />

        {/* Content area — pb clears the floating AI bar */}
        <div className="flex flex-1 items-center justify-center overflow-auto pb-28">
          <div className="flex max-w-xs flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Icon size={26} strokeWidth={1.5} className="text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <button className="mt-1 flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600">
              <Plus size={13} />
              New task
            </button>
          </div>
        </div>
      </div>

      {showEntityModal && activeWorkspaceId && (
        <EntityModal
          workspaceId={activeWorkspaceId}
          onClose={() => setShowEntityModal(false)}
          onCreated={handleEntityCreated}
        />
      )}
    </>
  );
}
