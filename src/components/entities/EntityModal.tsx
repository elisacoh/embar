"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createEntity } from "@/app/actions/entities";
import type { EntityData } from "@/lib/types";

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
  const [color, setColor] = useState(COLORS[0]!);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    const result = await createEntity({ workspaceId, name: name.trim(), type: "project", color });

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

        <form onSubmit={handleSubmit} className="p-6">
          <p className="mb-4 text-sm font-medium text-muted-foreground">What are you working on?</p>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Client project, Side hustle, Research…"
            autoFocus
            className="mb-5 w-full bg-transparent text-lg font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/40"
          />

          {/* Color picker row */}
          <div className="mb-5 flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-6 w-6 flex-none rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  boxShadow:
                    color === c ? `0 0 0 2px var(--background), 0 0 0 3.5px ${c}` : undefined,
                }}
              />
            ))}
          </div>

          {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: color }}
          >
            {loading ? "Creating…" : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}
