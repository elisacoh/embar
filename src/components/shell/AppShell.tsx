"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, CheckSquare, Mail, FileText, Bot } from "lucide-react";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { AIBar } from "./AIBar";
import { useUIStore, type Module } from "@/stores/ui";

interface AppShellProps {
  userEmail: string;
  workspaceName: string;
}

const MODULE_META: Record<
  Module,
  {
    icon: React.ElementType;
    label: string;
    description: string;
    status?: string;
    navItems?: string[];
  }
> = {
  dashboard: {
    icon: LayoutDashboard,
    label: "Dashboard",
    description: "Your daily overview — focus, priorities, and AI insights.",
    navItems: ["Overview", "Activity"],
  },
  tasks: {
    icon: CheckSquare,
    label: "Tasks",
    description: "Your workspace for deep, focused work.",
    navItems: ["Today", "Week", "All"],
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

function ModuleContent({ module }: { module: Module }) {
  const [activeNav, setActiveNav] = useState(0);
  const meta = MODULE_META[module];
  const Icon = meta.icon;

  return (
    <div className="flex h-full flex-col">
      {/* Module top nav */}
      <div className="flex h-10 flex-none items-center gap-1 border-b border-border px-4">
        <span className="mr-2 text-sm font-semibold text-foreground">{meta.label}</span>
        {meta.navItems?.map((item, i) => (
          <button
            key={item}
            onClick={() => setActiveNav(i)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activeNav === i
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Scrollable content area — pb clears the floating AI bar */}
      <div className="flex flex-1 items-center justify-center overflow-auto pb-28">
        <div className="flex max-w-xs flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Icon size={26} strokeWidth={1.5} className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{meta.label}</p>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
          </div>
          {meta.status && (
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              Coming in {meta.status}
            </span>
          )}
          {module === "tasks" && (
            <button className="mt-1 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600">
              Create your first task
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ userEmail, workspaceName }: AppShellProps) {
  const [hydrated, setHydrated] = useState(false);
  const activeModule = useUIStore((s) => s.activeModule);

  useEffect(() => {
    useUIStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Topbar userEmail={userEmail} workspaceName={workspaceName} />

      <div className="flex flex-1 overflow-hidden">
        {hydrated && <Sidebar />}

        {/* Main content — position relative so AI bar can float over it */}
        <main className="relative flex flex-1 flex-col overflow-hidden">
          {hydrated ? (
            <ModuleContent module={activeModule} />
          ) : (
            <div className="flex h-full flex-col">
              <div className="h-10 flex-none border-b border-border" />
              <div className="flex-1" />
            </div>
          )}

          {/* Floating AI bar — overlays the content, with fade gradient above it */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
            {/* Fade gradient so content blends into the bar */}
            <div className="h-16 w-full bg-gradient-to-t from-background via-background/80 to-transparent" />
            <div className="w-full bg-background/0 px-6 pb-5">
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
