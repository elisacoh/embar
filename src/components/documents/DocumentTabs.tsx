"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, FileText, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayPageTitle } from "@/lib/documents/display";
import type { DocHeading } from "@/lib/documents/html";
import { MAX_TAB_LEVEL } from "@/lib/documents/localStore";
import type { DocumentPage } from "@/lib/documents/types";

interface DocumentTabsProps {
  pages: DocumentPage[];
  activeId: string | null;
  outlines: Record<string, DocHeading[]>;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
  onAddSubTab: (parentId: string) => void;
  onRename: (id: string, title: string) => void;
  onReorder: (pages: DocumentPage[]) => void;
  onJumpToHeading: (pageId: string, headingId: string) => void;
}

const HEADING_INDENT: Record<DocHeading["level"], string> = {
  1: "pl-5",
  2: "pl-8",
  3: "pl-11",
};

const TAB_INDENT = ["pl-0", "pl-3", "pl-6"] as const;

function clampLevel(level: number, previousLevel: number | null): number {
  const max = previousLevel === null ? 0 : previousLevel + 1;
  return Math.min(MAX_TAB_LEVEL, Math.max(0, Math.min(level, max)));
}

function levelFromClientX(clientX: number, left: number): number {
  return Math.min(MAX_TAB_LEVEL, Math.max(0, Math.floor((clientX - left - 12) / 16)));
}

function parentIndex(pages: DocumentPage[], index: number): number {
  const level = pages[index]?.level ?? 0;
  for (let i = index - 1; i >= 0; i -= 1) {
    if ((pages[i]?.level ?? 0) < level) return i;
  }
  return -1;
}

function ancestorIds(pages: DocumentPage[], index: number): Set<string> {
  const ids = new Set<string>();
  let current = index;
  while (current >= 0) {
    const parent = parentIndex(pages, current);
    if (parent < 0) break;
    ids.add(pages[parent]!.id);
    current = parent;
  }
  return ids;
}

function isAncestorOf(
  pages: DocumentPage[],
  maybeAncestorId: string,
  descendantId: string
): boolean {
  const descendantIndex = pages.findIndex((page) => page.id === descendantId);
  if (descendantIndex < 0) return false;
  return ancestorIds(pages, descendantIndex).has(maybeAncestorId);
}

function hasChildTabs(pages: DocumentPage[], index: number): boolean {
  const level = pages[index]?.level ?? 0;
  const next = pages[index + 1];
  return Boolean(next && next.level > level);
}

function isPageVisible(pages: DocumentPage[], index: number, expandedId: string | null): boolean {
  if ((pages[index]?.level ?? 0) === 0) return true;
  const parent = parentIndex(pages, index);
  if (parent < 0) return true;
  if (!expandedId) return false;
  const parentId = pages[parent]!.id;
  return parentId === expandedId || isAncestorOf(pages, parentId, expandedId);
}

export function DocumentTabs({
  pages,
  activeId,
  outlines,
  onSelect,
  onClose,
  onAdd,
  onAddSubTab,
  onRename,
  onReorder,
  onJumpToHeading,
}: DocumentTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dropLevel, setDropLevel] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function commitDrop(targetIndex: number, clientX: number) {
    if (dragSrc === null) {
      setDragSrc(null);
      setDragOver(null);
      return;
    }
    const left = listRef.current?.getBoundingClientRect().left ?? 0;
    const next = [...pages];
    const [moved] = next.splice(dragSrc, 1);
    if (!moved) {
      setDragSrc(null);
      setDragOver(null);
      return;
    }
    const insertAt = Math.min(targetIndex, next.length);
    next.splice(insertAt, 0, moved);
    const prev = next[insertAt - 1] ?? null;
    const level = clampLevel(levelFromClientX(clientX, left), prev ? prev.level : null);
    next[insertAt] = { ...moved, level };
    const normalized: DocumentPage[] = [];
    next.forEach((page, i) => {
      const above = normalized[i - 1] ?? null;
      normalized.push({ ...page, level: clampLevel(page.level, above ? above.level : null) });
    });
    onReorder(normalized);
    setDragSrc(null);
    setDragOver(null);
  }

  return (
    <aside className="flex w-56 flex-none flex-col border-r border-border">
      <div className="flex h-8 flex-none items-center gap-1 px-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Open tabs
        </span>
        <div className="group relative ml-auto">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Ajouter un onglet"
            className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus size={12} />
          </button>
          <div
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          >
            Ajouter un onglet
          </div>
        </div>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto pb-28">
        {pages.map((page, index) => {
          if (!isPageVisible(pages, index, expandedId)) return null;
          const active = page.id === activeId;
          const headings = outlines[page.id] ?? [];
          const tabLabel = displayPageTitle(page.title, page.body);
          const expandable = hasChildTabs(pages, index) || headings.length > 0;
          const expanded = expandedId === page.id;
          return (
            <div
              key={page.id}
              className={cn("mb-1", dragOver === index && "opacity-50")}
              draggable={editingId !== page.id}
              onDragStart={() => setDragSrc(index)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(index);
                const left = listRef.current?.getBoundingClientRect().left ?? 0;
                const prev = pages[index === 0 ? -1 : index - 1];
                setDropLevel(
                  clampLevel(levelFromClientX(event.clientX, left), prev ? prev.level : null)
                );
              }}
              onDragEnd={() => {
                setDragSrc(null);
                setDragOver(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                commitDrop(index, event.clientX);
              }}
            >
              <TabRow
                page={page}
                index={index}
                active={active}
                tabLabel={tabLabel}
                highlightEmpty={active && !expanded}
                expandable={expandable}
                expanded={expanded}
                canDelete={pages.length > 1}
                canAddSubTab={page.level < MAX_TAB_LEVEL}
                dropPreview={dragOver === index ? dropLevel : null}
                onSelect={() => {
                  onSelect(page.id);
                  if (!expandable) return;
                  setExpandedId((current) => {
                    if (current !== page.id) return page.id;
                    const parent = parentIndex(pages, index);
                    return parent >= 0 ? pages[parent]!.id : null;
                  });
                }}
                onDelete={() => onClose(page.id)}
                onAddSubTab={() => {
                  setExpandedId(page.id);
                  onAddSubTab(page.id);
                }}
                onRename={(title) => onRename(page.id, title)}
                onEditingChange={(isEditing) => setEditingId(isEditing ? page.id : null)}
              />

              {expanded &&
                headings.map((heading) => (
                  <button
                    key={heading.id}
                    onClick={() => onJumpToHeading(page.id, heading.id)}
                    className={cn(
                      "flex w-full truncate py-1 pr-2 text-left text-[11px] transition-colors hover:text-foreground",
                      TAB_INDENT[page.level] ?? TAB_INDENT[0],
                      HEADING_INDENT[heading.level],
                      heading.level === 1 ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {heading.text}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function TabRow({
  page,
  index,
  active,
  tabLabel,
  highlightEmpty,
  expandable,
  expanded,
  canDelete,
  canAddSubTab,
  dropPreview,
  onSelect,
  onDelete,
  onAddSubTab,
  onRename,
  onEditingChange,
}: {
  page: DocumentPage;
  index: number;
  active: boolean;
  tabLabel: string;
  highlightEmpty: boolean;
  expandable: boolean;
  expanded: boolean;
  canDelete: boolean;
  canAddSubTab: boolean;
  dropPreview: number | null;
  onSelect: () => void;
  onDelete: () => void;
  onAddSubTab: () => void;
  onRename: (title: string) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(page.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const indent = dropPreview ?? page.level;

  useEffect(() => {
    setDraft(page.title);
  }, [page.title]);

  useEffect(() => {
    if (!editing) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editing]);

  function submitRename() {
    onRename(draft.trim());
    setEditing(false);
    onEditingChange(false);
  }

  return (
    <div
      className={cn(
        "group relative flex items-center gap-0.5 px-1.5 py-0.5",
        highlightEmpty && "bg-brand-50 dark:bg-brand-500/10"
      )}
    >
      <button
        onClick={onSelect}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDraft(page.title);
          setEditing(true);
          onEditingChange(true);
        }}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pr-2 text-left text-xs font-medium transition-colors",
          TAB_INDENT[indent] ?? TAB_INDENT[0],
          active ? "text-brand-600" : "text-foreground hover:bg-muted"
        )}
      >
        {expandable ? (
          <ChevronRight
            size={12}
            className={cn("flex-none opacity-70 transition-transform", expanded && "rotate-90")}
          />
        ) : (
          <FileText size={13} className="flex-none opacity-70" />
        )}
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={submitRename}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitRename();
              }
              if (event.key === "Escape") {
                setDraft(page.title);
                setEditing(false);
                onEditingChange(false);
              }
            }}
            className="min-w-0 flex-1 bg-transparent outline-none"
            aria-label={`Rename tab ${index + 1}`}
          />
        ) : (
          <span className="truncate">{tabLabel}</span>
        )}
      </button>

      <div className="relative mr-0.5">
        <button
          type="button"
          aria-label={`More options for ${tabLabel}`}
          aria-expanded={menuOpen}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground",
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <MoreHorizontal size={13} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg">
              <button
                type="button"
                disabled={!canAddSubTab}
                onClick={() => {
                  setMenuOpen(false);
                  onAddSubTab();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={12} />
                Add a sub-tab
              </button>
              <button
                type="button"
                disabled={!canDelete}
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
