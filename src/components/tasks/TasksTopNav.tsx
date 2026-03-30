"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityData } from "@/lib/types";

export type TimeView = "today" | "week" | "month" | "all";

const TIME_VIEWS: { id: TimeView; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
];

// Theme views — Sprint 7
const THEMES = [{ id: "default", label: "Default" }];

interface TasksTopNavProps {
  activeTimeView: TimeView;
  onTimeViewChange: (view: TimeView) => void;
  entities: EntityData[];
  activeEntityId: string | null; // null = All
  onEntityChange: (id: string | null) => void;
  onAddEntity: () => void;
}

function NavPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full px-2.5 py-[3px] text-xs font-medium transition-colors",
        active
          ? "bg-brand-500 text-white"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-2 h-3.5 w-px bg-border" aria-hidden="true" />;
}

export function TasksTopNav({
  activeTimeView,
  onTimeViewChange,
  entities,
  activeEntityId,
  onEntityChange,
  onAddEntity,
}: TasksTopNavProps) {
  return (
    <div
      className="flex h-10 flex-none items-center gap-0.5 border-b border-border px-3"
      role="navigation"
      aria-label="Tasks navigation"
    >
      {/* Left — time views (functional) */}
      <div className="flex items-center gap-0.5" role="group" aria-label="Time view">
        {TIME_VIEWS.map((v) => (
          <NavPill
            key={v.id}
            active={activeTimeView === v.id}
            onClick={() => onTimeViewChange(v.id)}
          >
            {v.label}
          </NavPill>
        ))}
      </div>

      <Divider />

      {/* Center — entity contexts */}
      <div className="flex items-center gap-0.5" role="group" aria-label="Entity context">
        <NavPill active={activeEntityId === null} onClick={() => onEntityChange(null)}>
          All
        </NavPill>

        {entities.map((entity) => (
          <NavPill
            key={entity.id}
            active={activeEntityId === entity.id}
            onClick={() => onEntityChange(entity.id)}
          >
            <span
              className="h-1.5 w-1.5 flex-none rounded-full"
              style={{ backgroundColor: activeEntityId === entity.id ? "white" : entity.color }}
            />
            {entity.name}
          </NavPill>
        ))}

        <button
          onClick={onAddEntity}
          aria-label="Add entity"
          className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus size={11} />
        </button>
      </div>

      <Divider />

      {/* Right — themes (Sprint 7) */}
      <div className="flex items-center gap-0.5" role="group" aria-label="Theme">
        {THEMES.map((t) => (
          <NavPill key={t.id} active={true}>
            {t.label}
          </NavPill>
        ))}
      </div>
    </div>
  );
}
