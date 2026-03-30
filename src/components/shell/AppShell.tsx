"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, Mail, FileText, Bot } from "lucide-react";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { AIBar } from "./AIBar";
import { TasksModule } from "@/components/tasks/TasksModule";
import { useUIStore, type Module } from "@/stores/ui";
import type { WorkspaceData } from "@/lib/types";

interface AppShellProps {
  userEmail: string;
  workspaces: WorkspaceData[];
  initialActiveWorkspaceId: string;
}

// Generic placeholder for modules not yet built
const PLACEHOLDER_META: Partial<
  Record<Module, { icon: React.ElementType; label: string; description: string; status: string }>
> = {
  dashboard: {
    icon: LayoutDashboard,
    label: "Dashboard",
    description: "Your daily overview — focus, priorities, and AI insights.",
    status: "Sprint 4",
  },
  email: {
    icon: Mail,
    label: "Email",
    description: "Unified email with AI-powered context.",
    status: "Sprint 2",
  },
  documents: {
    icon: FileText,
    label: "Documents",
    description: "Documents and notes linked to your work.",
    status: "Sprint 3",
  },
  agents: {
    icon: Bot,
    label: "Agents",
    description: "Autonomous AI agents that act on your behalf.",
    status: "Phase 4",
  },
};

function PlaceholderModule({ module }: { module: Module }) {
  const meta = PLACEHOLDER_META[module];
  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <div className="flex h-full flex-col">
      {/* Minimal top bar */}
      <div className="flex h-10 flex-none items-center border-b border-border px-4">
        <span className="text-sm font-semibold text-foreground">{meta.label}</span>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto pb-28">
        <div className="flex max-w-xs flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Icon size={26} strokeWidth={1.5} className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{meta.label}</p>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            Coming in {meta.status}
          </span>
        </div>
      </div>
    </div>
  );
}

function ModuleRouter({ module }: { module: Module }) {
  if (module === "tasks") return <TasksModule />;
  return <PlaceholderModule module={module} />;
}

const SESSION_INIT_KEY = "embar_initialized";

export function AppShell({ userEmail, workspaces, initialActiveWorkspaceId }: AppShellProps) {
  const [ready, setReady] = useState(false);
  const activeModule = useUIStore((s) => s.activeModule);

  useEffect(() => {
    useUIStore.getState().setActiveWorkspaceId(initialActiveWorkspaceId);

    const isReturning = sessionStorage.getItem(SESSION_INIT_KEY);
    if (isReturning) {
      const saved = localStorage.getItem("embar-module") as Module | null;
      if (saved) useUIStore.getState().setActiveModule(saved);
    } else {
      sessionStorage.setItem(SESSION_INIT_KEY, "1");
    }
    setReady(true);
  }, [initialActiveWorkspaceId]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Topbar
        userEmail={userEmail}
        workspaces={workspaces}
        initialActiveWorkspaceId={initialActiveWorkspaceId}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar is gated on ready so it first renders with the correct
            active module — avoids the brief dashboard→tasks icon flash */}
        {ready && <Sidebar />}

        {/* Main content — relative so floating AI bar overlays correctly */}
        <main className="relative flex flex-1 flex-col overflow-hidden">
          {ready ? (
            <ModuleRouter module={activeModule} />
          ) : (
            <div className="flex h-full flex-col">
              <div className="h-10 flex-none border-b border-border" />
            </div>
          )}

          {/* Floating AI bar */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
            <div className="h-16 w-full bg-gradient-to-t from-background via-background/80 to-transparent" />
            <div className="w-full px-6 pb-5">
              <div className="pointer-events-auto mx-auto w-full max-w-2xl">
                <AIBar />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
