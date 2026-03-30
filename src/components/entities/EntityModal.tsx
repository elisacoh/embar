"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createEntity } from "@/app/actions/entities";
import type { EntityData } from "@/lib/types";

const TYPES = [
  { value: "client", label: "Client", emoji: "🤝" },
  { value: "project", label: "Project", emoji: "📁" },
  { value: "subject", label: "Subject", emoji: "📌" },
] as const;

const COLORS = [
  "#3b82f6", // blue (default)
  "#f97316", // brand orange
  "#8b5cf6", // purple
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#64748b", // slate
];

interface EntityModalProps {
  workspaceId: string;
  onClose: () => void;
  onCreated: (entity: EntityData) => void;
}

export function EntityModal({ workspaceId, onClose, onCreated }: EntityModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"client" | "project" | "subject">("project");
  const [color, setColor] = useState(COLORS[0]!);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    const result = await createEntity({ workspaceId, name: name.trim(), type, color });

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    onCreated(result.entity);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-background shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
        >
          <X size={14} />
        </button>

        <form onSubmit={handleSubmit} className="p-5">
          {/* Color swatch + name — inline, Notion-style */}
          <div className="mb-4 flex items-center gap-3">
            {/* Color picker */}
            <div className="relative flex-none">
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="h-8 w-8 rounded-full transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
                style={{ backgroundColor: color }}
                aria-label="Pick color"
              />
              {pickerOpen && (
                <>
                  {/* Click-outside overlay */}
                  <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                  {/* Palette */}
                  <div className="absolute left-0 top-10 z-20 grid grid-cols-3 gap-2 rounded-xl border border-border bg-popover p-3 shadow-xl">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setColor(c);
                          setPickerOpen(false);
                        }}
                        className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                        style={{
                          backgroundColor: c,
                          boxShadow:
                            color === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : undefined,
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Entity name"
              autoFocus
              className="flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Type pills */}
          <div className="mb-4 flex items-center gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  type === t.value
                    ? "border-transparent bg-muted text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-sm leading-none">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>

          {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
