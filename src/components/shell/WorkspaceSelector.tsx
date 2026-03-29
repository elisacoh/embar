"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Check, User, Briefcase, FolderKanban, X } from "lucide-react";
import { createWorkspace, setLastWorkspace } from "@/app/actions/workspace";
import type { WorkspaceData } from "@/lib/types";

// Deterministic color dot from workspace id
const PALETTE = ["#f97316", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];
function workspaceColor(id: string): string {
  const sum = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[sum % PALETTE.length]!;
}

const TYPE_META: Record<WorkspaceData["type"], { icon: React.ElementType; label: string }> = {
  personal: { icon: User, label: "Personal" },
  professional: { icon: Briefcase, label: "Professional" },
  project: { icon: FolderKanban, label: "Project" },
};

interface WorkspaceSelectorProps {
  initialWorkspaces: WorkspaceData[];
  initialActiveId: string;
}

export function WorkspaceSelector({ initialWorkspaces, initialActiveId }: WorkspaceSelectorProps) {
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkspaceData["type"]>("personal");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const activeWs = workspaces.find((w) => w.id === activeId) ?? workspaces[0];

  async function handleSwitch(ws: WorkspaceData) {
    setOpen(false);
    setActiveId(ws.id);
    await setLastWorkspace(ws.id);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setFormError("");

    const result = await createWorkspace(name.trim(), type);

    if ("error" in result) {
      setFormError(result.error);
      setCreating(false);
      return;
    }

    const newWs = result.workspace;
    setWorkspaces((prev) => [...prev, newWs]);
    setActiveId(newWs.id);
    await setLastWorkspace(newWs.id);
    setShowModal(false);
    setName("");
    setType("personal");
    setCreating(false);
  }

  function openModal() {
    setOpen(false);
    setShowModal(true);
  }

  return (
    <>
      {/* Trigger + dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {activeWs && (
            <span
              className="h-2 w-2 flex-none rounded-full"
              style={{ backgroundColor: workspaceColor(activeWs.id) }}
            />
          )}
          <span className="max-w-[180px] truncate">{activeWs?.name ?? "Select workspace"}</span>
          <ChevronDown
            size={13}
            className={`flex-none text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="absolute left-1/2 top-full z-50 mt-1.5 w-60 -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
            {/* Workspace list */}
            <div className="p-1.5">
              <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Your workspaces
              </p>
              {workspaces.map((ws) => {
                const { icon: Icon } = TYPE_META[ws.type];
                const isActive = ws.id === activeId;
                return (
                  <button
                    key={ws.id}
                    onClick={() => handleSwitch(ws)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <span
                      className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-white"
                      style={{ backgroundColor: workspaceColor(ws.id) }}
                    >
                      <Icon size={12} />
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-foreground">
                      {ws.name}
                    </span>
                    {isActive && <Check size={13} className="flex-none text-brand-500" />}
                  </button>
                );
              })}
            </div>

            {/* Footer action */}
            <div className="border-t border-border p-1.5">
              <button
                onClick={openModal}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Plus size={14} className="flex-none" />
                New workspace
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New workspace modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl">
            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">New workspace</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A separate space for a project, team, or area of life.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="ml-3 flex h-6 w-6 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Client Work, Personal, Side Project"
                  autoFocus
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["personal", "professional", "project"] as const).map((t) => {
                    const { icon: Icon, label } = TYPE_META[t];
                    const selected = type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all ${
                          selected
                            ? "border-brand-400 bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-950/40 dark:text-brand-400"
                            : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon size={16} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {formError && <p className="text-xs text-destructive">{formError}</p>}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || creating}
                  className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
