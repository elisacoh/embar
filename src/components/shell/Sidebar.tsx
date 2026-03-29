"use client";

import { LayoutDashboard, CheckSquare, Mail, FileText, Bot, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore, type Module } from "@/stores/ui";

const modules: { id: Module; icon: React.ElementType; label: string }[] = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { id: "tasks", icon: CheckSquare, label: "Tasks" },
  { id: "email", icon: Mail, label: "Email" },
  { id: "documents", icon: FileText, label: "Documents" },
  { id: "agents", icon: Bot, label: "Agents" },
];

function SidebarItem({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex h-11 w-full items-center justify-center transition-colors",
          isActive
            ? "bg-brand-50 text-brand-600"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {isActive && (
          <span className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-brand-500" />
        )}
        <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
      </button>

      {/* Tooltip */}
      <div
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
      >
        {label}
        <span className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-border" />
      </div>
    </div>
  );
}

export function Sidebar() {
  const { activeModule, setActiveModule } = useUIStore();

  return (
    <nav
      aria-label="Modules"
      className="flex h-full w-14 flex-none flex-col border-r border-border bg-sidebar"
    >
      {/* Module icons */}
      <div className="flex flex-col gap-0.5 py-2">
        {modules.map(({ id, icon, label }) => (
          <SidebarItem
            key={id}
            icon={icon}
            label={label}
            isActive={activeModule === id}
            onClick={() => setActiveModule(id)}
          />
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings at bottom */}
      <div className="group relative pb-2">
        <button
          aria-label="Settings"
          className="flex h-11 w-full items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <div
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
        >
          Settings
        </div>
      </div>
    </nav>
  );
}
