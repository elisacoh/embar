"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityData } from "@/lib/types";

interface EntityPickerProps {
  entities: EntityData[];
  value: string | null;
  onChange: (id: string | null) => void;
}

export function EntityPicker({ entities, value, onChange }: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = entities.find((e) => e.id === value) ?? null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
          selected
            ? "border-transparent bg-muted text-foreground"
            : "border-border text-muted-foreground hover:text-foreground"
        )}
      >
        {selected ? (
          <>
            <span
              className="h-2 w-2 flex-none rounded-full"
              style={{ backgroundColor: selected.color }}
            />
            {selected.name}
          </>
        ) : (
          <span className="text-muted-foreground/60">No context</span>
        )}
        <ChevronDown size={11} className="text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg">
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center px-3 py-1.5 text-xs transition-colors hover:bg-muted",
                !value ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              No context
            </button>
            {entities.length > 0 && <div className="my-1 border-t border-border" />}
            {entities.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  onChange(e.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted",
                  value === e.id ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                <span
                  className="h-2 w-2 flex-none rounded-full"
                  style={{ backgroundColor: e.color }}
                />
                {e.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
