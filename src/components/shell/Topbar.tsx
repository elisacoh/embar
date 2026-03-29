"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WorkspaceSelector } from "./WorkspaceSelector";
import type { WorkspaceData } from "@/lib/types";

interface TopbarProps {
  userEmail: string;
  workspaces: WorkspaceData[];
  initialActiveWorkspaceId: string;
}

function getInitials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/);
  const first = parts[0] ?? "";
  const second = parts[1] ?? "";
  if (second.length > 0) {
    return ((first[0] ?? "") + (second[0] ?? "")).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function Topbar({ userEmail, workspaces, initialActiveWorkspaceId }: TopbarProps) {
  const router = useRouter();
  const initials = getInitials(userEmail);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem("embar_remember_me");
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="relative flex h-12 flex-none items-center border-b border-border bg-background">
      {/* Left — logo mark, aligns with the 56px sidebar */}
      <div className="flex w-14 flex-none items-center justify-center">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500">
          <span className="text-sm font-black text-white">e</span>
        </div>
      </div>

      {/* Center — workspace selector, truly centered in the header */}
      <div className="pointer-events-none absolute inset-x-0 flex justify-center">
        <div className="pointer-events-auto">
          <WorkspaceSelector
            initialWorkspaces={workspaces}
            initialActiveId={initialActiveWorkspaceId}
          />
        </div>
      </div>

      {/* Right — theme toggle + user avatar */}
      <div className="ml-auto flex items-center gap-1 px-3">
        <ThemeToggle />
        <div className="group relative flex items-center">
          <button
            onClick={handleLogout}
            title={`${userEmail} — click to sign out`}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 ring-2 ring-transparent transition-all hover:bg-brand-200 hover:ring-brand-300"
          >
            {initials}
          </button>
          {/* Hover tooltip */}
          <div className="pointer-events-none absolute right-0 top-full z-50 mt-1.5 flex flex-col items-end opacity-0 transition-opacity group-hover:opacity-100">
            <div className="rounded-md border border-border bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-sm">
              <p className="font-medium">{userEmail}</p>
              <p className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                <LogOut size={10} />
                Sign out
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
