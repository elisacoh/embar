"use client";

import { useRef, useState } from "react";
import { Paperclip, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayVersionTitle, fallbackVersionCaption } from "@/lib/documents/versions";
import type { DocumentAsset, DocumentVersion } from "@/lib/documents/types";

interface DocumentHistoryProps {
  versions: DocumentVersion[];
  assets: DocumentAsset[];
  versionMessage: string | null;
  savingVersion: boolean;
  onSaveVersion: (label: string) => void;
  onToggleHighlighted: (id: string, highlighted: boolean) => void;
  onAttachFile: (file: File) => void;
  onOpenAsset: (id: string) => void;
}

export function DocumentHistory({
  versions,
  assets,
  versionMessage,
  savingVersion,
  onSaveVersion,
  onToggleHighlighted,
  onAttachFile,
  onOpenAsset,
}: DocumentHistoryProps) {
  const [label, setLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Versions
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Current draft</p>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Before recruiter review"
          aria-label="Version label"
          className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={() => {
            onSaveVersion(label.trim());
            setLabel("");
          }}
          disabled={savingVersion}
          className="mt-2 w-full rounded-md bg-brand-500 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {savingVersion ? "Saving…" : "Save this version"}
        </button>
        {versionMessage && (
          <p className="mt-2 text-[11px] text-muted-foreground" aria-live="polite">
            {versionMessage}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {versions.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">No saved versions yet.</p>
        ) : (
          <ul className="space-y-1">
            {versions.map((version) => {
              const fallback = fallbackVersionCaption(version.versionNumber, version.createdAt);
              const title = displayVersionTitle(version.versionNumber, version.label);
              return (
                <li
                  key={version.id}
                  className="flex items-start gap-1 rounded-md px-1.5 py-1.5 hover:bg-muted/60"
                >
                  <button
                    type="button"
                    onClick={() => onToggleHighlighted(version.id, !version.highlighted)}
                    aria-label={version.highlighted ? "Unmark as important" : "Mark as important"}
                    className={cn(
                      "mt-0.5 flex h-6 w-6 items-center justify-center rounded-md",
                      version.highlighted
                        ? "text-brand-500"
                        : "text-muted-foreground/40 hover:text-brand-500"
                    )}
                  >
                    <Star size={13} fill={version.highlighted ? "currentColor" : "none"} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {version.highlighted ? `★ ${title}` : title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{fallback.subtitle}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Files
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
          >
            <Paperclip size={12} />
            Attach
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onAttachFile(file);
              event.target.value = "";
            }}
          />
        </div>
        {assets.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No files attached.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {assets.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => onOpenAsset(asset.id)}
                  className="w-full truncate rounded-md px-1 py-1 text-left text-xs text-foreground hover:bg-muted"
                >
                  {asset.filename}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
