"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Pencil, Palette, Archive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityData } from "@/lib/types";

export type TimeView = "today" | "week" | "month" | "all";

const TIME_VIEWS: { id: TimeView; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
];

const THEMES = [{ id: "default", label: "Default" }];

const COLORS = [
  "#3b82f6",
  "#f97316",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#64748b",
];

interface TasksTopNavProps {
  activeTimeView: TimeView;
  onTimeViewChange: (view: TimeView) => void;
  entities: EntityData[];
  activeEntityId: string | null;
  onEntityChange: (id: string | null) => void;
  onAddEntity: () => void;
  onRename: (id: string, name: string) => void;
  onRecolor: (id: string, color: string) => void;
  onArchive: (id: string) => void;
  onDeleteRequest: (entity: EntityData) => void;
  onReorder: (orderedIds: string[]) => void;
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

// ─── Entity pill with right-click menu, inline rename, color picker ───────────

type PillMode = "idle" | "menu" | "rename" | "color";

function EntityPill({
  entity,
  active,
  onSelect,
  onRename,
  onRecolor,
  onArchive,
  onDeleteRequest,
  dragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  entity: EntityData;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onRecolor: (color: string) => void;
  onArchive: () => void;
  onDeleteRequest: () => void;
  dragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const [mode, setMode] = useState<PillMode>("idle");
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [draft, setDraft] = useState(entity.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  // Keep draft in sync if name changes externally
  useEffect(() => {
    setDraft(entity.name);
  }, [entity.name]);

  // Focus input when entering rename mode
  useEffect(() => {
    if (mode === "rename") {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [mode]);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMode("menu");
  }

  function submitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== entity.name) onRename(trimmed);
    else setDraft(entity.name);
    setMode("idle");
  }

  const pillContent =
    mode === "rename" ? (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={submitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submitRename();
          }
          if (e.key === "Escape") {
            setDraft(entity.name);
            setMode("idle");
          }
        }}
        className="w-24 min-w-0 bg-transparent text-xs font-medium outline-none"
        onClick={(e) => e.stopPropagation()}
      />
    ) : (
      <>
        <span
          className="h-1.5 w-1.5 flex-none rounded-full"
          style={{ backgroundColor: active ? "white" : entity.color }}
        />
        {entity.name}
      </>
    );

  return (
    <div
      ref={pillRef}
      className={cn("relative flex-none", dragOver && "opacity-50")}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      <button
        onClick={onSelect}
        onDoubleClick={() => {
          onSelect();
          setMode("rename");
        }}
        onContextMenu={handleContextMenu}
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-[3px] text-xs font-medium transition-colors",
          active
            ? "bg-brand-500 text-white"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {pillContent}
      </button>

      {/* Context menu — fixed, dismisses on outside click */}
      {mode === "menu" && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMode("idle")} />
          <div
            className="fixed z-50 min-w-[140px] overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg"
            style={{ top: menuPos.y + 4, left: menuPos.x }}
          >
            <MenuItem icon={Pencil} label="Rename" onClick={() => setMode("rename")} />
            <MenuItem icon={Palette} label="Change color" onClick={() => setMode("color")} />
            <div className="my-1 border-t border-border" />
            <MenuItem
              icon={Archive}
              label="Archive"
              onClick={() => {
                setMode("idle");
                onArchive();
              }}
            />
            <MenuItem
              icon={Trash2}
              label="Delete"
              danger
              onClick={() => {
                setMode("idle");
                onDeleteRequest();
              }}
            />
          </div>
        </>
      )}

      {/* Color picker overlay — anchored below the pill */}
      {mode === "color" && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMode("idle")} />
          <div className="absolute left-0 top-full z-50 mt-1.5 grid grid-cols-3 gap-2 rounded-xl border border-border bg-popover p-3 shadow-xl">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onRecolor(c);
                  setMode("idle");
                }}
                className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  boxShadow:
                    entity.color === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : undefined,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted",
        danger ? "text-destructive" : "text-foreground"
      )}
    >
      <Icon size={12} className="flex-none" />
      {label}
    </button>
  );
}

// ─── Main nav ──────────────────────────────────────────────────────────────────

export function TasksTopNav({
  activeTimeView,
  onTimeViewChange,
  entities,
  activeEntityId,
  onEntityChange,
  onAddEntity,
  onRename,
  onRecolor,
  onArchive,
  onDeleteRequest,
  onReorder,
}: TasksTopNavProps) {
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  function handleDrop(targetIndex: number) {
    if (dragSrc === null || dragSrc === targetIndex) {
      setDragSrc(null);
      setDragOver(null);
      return;
    }
    const reordered = [...entities];
    const [moved] = reordered.splice(dragSrc, 1);
    reordered.splice(targetIndex, 0, moved!);
    onReorder(reordered.map((e) => e.id));
    setDragSrc(null);
    setDragOver(null);
  }

  return (
    <div
      className="flex h-10 flex-none items-center gap-0.5 border-b border-border px-3"
      role="navigation"
      aria-label="Tasks navigation"
    >
      {/* Left — time views (flex-none so it never shrinks) */}
      <div className="flex flex-none items-center gap-0.5" role="group" aria-label="Time view">
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

      {/* Center — entity contexts (scrollable, flex-1 so it takes remaining space) */}
      <div
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Entity context"
      >
        <NavPill active={activeEntityId === null} onClick={() => onEntityChange(null)}>
          All
        </NavPill>

        {entities.map((entity, i) => (
          <EntityPill
            key={entity.id}
            entity={entity}
            active={activeEntityId === entity.id}
            onSelect={() => onEntityChange(entity.id)}
            onRename={(name) => onRename(entity.id, name)}
            onRecolor={(color) => onRecolor(entity.id, color)}
            onArchive={() => onArchive(entity.id)}
            onDeleteRequest={() => onDeleteRequest(entity)}
            dragOver={dragOver === i}
            onDragStart={() => setDragSrc(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(i);
            }}
            onDragEnd={() => {
              setDragSrc(null);
              setDragOver(null);
            }}
            onDrop={() => handleDrop(i)}
          />
        ))}

        <button
          onClick={onAddEntity}
          aria-label="Add entity"
          className="ml-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus size={11} />
        </button>
      </div>

      <Divider />

      {/* Right — themes (flex-none so it never shrinks) */}
      <div className="flex flex-none items-center gap-0.5" role="group" aria-label="Theme">
        {THEMES.map((t) => (
          <NavPill key={t.id} active={true}>
            {t.label}
          </NavPill>
        ))}
      </div>
    </div>
  );
}
