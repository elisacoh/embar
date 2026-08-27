"use client";

import { useEffect, useState } from "react";
import { Folder, FolderPlus, Plus, Trash2 } from "lucide-react";
import {
  displayFolderName,
  displayTitle,
  firstWordsFromHtml,
  formatUpdatedAt,
} from "@/lib/documents/display";
import { cn } from "@/lib/utils";
import type { DocFolder, Document } from "@/lib/documents/types";

interface DocumentsLibraryProps {
  documents: Document[];
  folders: DocFolder[];
  currentFolderId: string | null;
  canCreate: boolean;
  onOpen: (id: string) => void;
  onOpenFolder: (id: string | null) => void;
  onCreate: () => void;
  onCreateFolder: () => void;
  onDelete: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onMoveDocument: (docId: string, folderId: string | null) => void;
  autoEditFolderId?: string | null;
}

export function DocumentsLibrary({
  documents,
  folders,
  currentFolderId,
  canCreate,
  onOpen,
  onOpenFolder,
  onCreate,
  onCreateFolder,
  onDelete,
  onDeleteFolder,
  onRenameFolder,
  onMoveDocument,
  autoEditFolderId,
}: DocumentsLibraryProps) {
  const [dragDocId, setDragDocId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(autoEditFolderId ?? null);

  useEffect(() => {
    if (autoEditFolderId) setEditingFolderId(autoEditFolderId);
  }, [autoEditFolderId]);

  const currentFolders = folders.filter((folder) => folder.parentId === currentFolderId);
  const currentDocuments = documents.filter((doc) => doc.folderId === currentFolderId);
  const trail = folderTrail(folders, currentFolderId);
  const isEmpty = currentFolders.length === 0 && currentDocuments.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center gap-1.5 overflow-x-auto px-6 pt-4 text-xs">
        <button
          type="button"
          onClick={() => onOpenFolder(null)}
          onDragOver={(event) => {
            if (!dragDocId) return;
            event.preventDefault();
            setDropTarget("root");
          }}
          onDragLeave={() => {
            if (dropTarget === "root") setDropTarget(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragDocId) onMoveDocument(dragDocId, null);
            setDragDocId(null);
            setDropTarget(null);
          }}
          className={cn(
            "rounded-md px-1.5 py-0.5 font-medium transition-colors",
            currentFolderId === null
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
            dropTarget === "root" && "bg-brand-50 text-brand-600 dark:bg-brand-500/10"
          )}
        >
          All documents
        </button>
        {trail.map((folder) => (
          <span key={folder.id} className="flex items-center gap-1.5">
            <span className="text-muted-foreground/50">/</span>
            <button
              type="button"
              onClick={() => onOpenFolder(folder.id)}
              className={cn(
                "rounded-md px-1.5 py-0.5 font-medium transition-colors",
                folder.id === currentFolderId
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {displayFolderName(folder.name)}
            </button>
          </span>
        ))}
      </div>

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center overflow-auto pb-28">
          <div className="flex max-w-xs flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Folder size={26} strokeWidth={1.5} className="text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {currentFolderId ? "This folder is empty" : "No documents yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentFolderId
                  ? "Create a document here, or drag one into this folder."
                  : "Create a folder or a note to start organizing your work."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onCreateFolder}
                disabled={!canCreate}
                className="mt-1 flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <FolderPlus size={13} />
                New folder
              </button>
              <button
                onClick={onCreate}
                disabled={!canCreate}
                className="mt-1 flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                <Plus size={13} />
                New document
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-28 pt-6">
          <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {currentFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                count={
                  documents.filter((doc) => doc.folderId === folder.id).length +
                  folders.filter((item) => item.parentId === folder.id).length
                }
                isDropTarget={dropTarget === folder.id}
                editing={editingFolderId === folder.id}
                onOpen={() => onOpenFolder(folder.id)}
                onDelete={() => onDeleteFolder(folder.id)}
                onRename={(name) => {
                  onRenameFolder(folder.id, name);
                  setEditingFolderId(null);
                }}
                onStartRename={() => setEditingFolderId(folder.id)}
                onDragOver={() => setDropTarget(folder.id)}
                onDragLeave={() => {
                  if (dropTarget === folder.id) setDropTarget(null);
                }}
                onDrop={() => {
                  if (dragDocId) onMoveDocument(dragDocId, folder.id);
                  setDragDocId(null);
                  setDropTarget(null);
                }}
              />
            ))}

            {currentDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                dragging={dragDocId === doc.id}
                onOpen={() => onOpen(doc.id)}
                onDelete={() => onDelete(doc.id)}
                onDragStart={() => setDragDocId(doc.id)}
                onDragEnd={() => {
                  setDragDocId(null);
                  setDropTarget(null);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function folderTrail(folders: DocFolder[], folderId: string | null): DocFolder[] {
  const trail: DocFolder[] = [];
  let current = folders.find((folder) => folder.id === folderId) ?? null;
  while (current) {
    trail.unshift(current);
    current = folders.find((folder) => folder.id === current?.parentId) ?? null;
  }
  return trail;
}

function FolderCard({
  folder,
  count,
  isDropTarget,
  editing,
  onOpen,
  onDelete,
  onRename,
  onStartRename,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  folder: DocFolder;
  count: number;
  isDropTarget: boolean;
  editing: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onStartRename: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
}) {
  const [draft, setDraft] = useState(folder.name);
  const name = displayFolderName(folder.name);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={cn("group relative flex flex-col items-center", isDropTarget && "is-drop")}
    >
      <button
        type="button"
        onClick={onOpen}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDraft(folder.name);
          onStartRename();
        }}
        aria-label={name}
        className="flex w-full flex-col items-center gap-2.5 text-center"
      >
        <span className={cn("lib-folder block w-full", isDropTarget && "is-drop")}>
          <span className="lib-folder-tab" />
          <span className="lib-folder-body" />
        </span>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => onRename(draft.trim())}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onRename(draft.trim());
              }
              if (event.key === "Escape") onRename(folder.name);
            }}
            className="w-full rounded-md border border-border bg-background px-1.5 py-0.5 text-center text-sm font-medium outline-none focus:ring-1 focus:ring-brand-500"
          />
        ) : (
          <span className="w-full truncate text-sm font-medium text-foreground">{name}</span>
        )}
        <span className="-mt-1.5 text-[11px] text-muted-foreground">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${name}`}
        className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function DocumentCard({
  doc,
  dragging,
  onOpen,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  doc: Document;
  dragging: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const title = displayTitle(doc);
  const preview = firstWordsFromHtml(doc.pages?.[0]?.body || doc.body || "", 28);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn("group relative flex flex-col items-center", dragging && "opacity-50")}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={title}
        className="flex w-full flex-col items-center gap-2.5 text-center"
      >
        <span className="lib-doc-sheet flex flex-col px-2.5 py-3 text-left">
          {preview ? (
            <span className="line-clamp-6 text-[9px] leading-[1.35] text-muted-foreground/80">
              {preview}
            </span>
          ) : null}
        </span>
        <span className="w-full truncate text-sm font-medium text-foreground">{title}</span>
        <span className="-mt-1.5 text-[11px] text-muted-foreground">
          {formatUpdatedAt(doc.updatedAt)}
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${title}`}
        className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
