"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, FolderPlus, Plus } from "lucide-react";
import { useUIStore } from "@/stores/ui";
import type {
  DocFolder,
  Document,
  DocumentAsset,
  DocumentFieldValue,
  DocumentPage,
  DocumentType,
  DocumentVersion,
  FieldDefinition,
} from "@/lib/documents/types";
import { extractHeadingsFromHtml, type DocHeading } from "@/lib/documents/html";
import {
  createBlankDocument,
  createBlankFolder,
  createBlankPage,
  clearLibrary,
  hasLocalLibrary,
  loadLibrary,
  persistLibrary,
  upsertDocument,
} from "@/lib/documents/localStore";
import {
  createDocumentRecord,
  createFolderRecord,
  deleteDocumentRecord,
  deleteFolderRecord,
  importLocalDocumentLibrary,
  listDocumentLibrary,
  renameFolderRecord,
  saveDocumentWorkingState,
  updateDocumentRecord,
} from "@/app/actions/documents";
import {
  attachDocumentAsset,
  createDocumentAssetUrl,
  listDocumentAssets,
  listDocumentVersions,
  saveDocumentVersion,
  setDocumentVersionHighlighted,
} from "@/app/actions/documentVersions";
import {
  listDocumentFieldValues,
  listDocumentTypes,
  listFieldDefinitions,
  setDocumentType,
  upsertDocumentFieldValue,
} from "@/app/actions/documentTypes";
import { DocumentEditor } from "./DocumentEditor";
import { DocumentHistory } from "./DocumentHistory";
import { DocumentProperties } from "./DocumentProperties";
import { DocumentTabs } from "./DocumentTabs";
import { DocumentsLibrary } from "./DocumentsLibrary";

type DocsView = "library" | "editor";

function pageOutlines(pages: DocumentPage[]): Record<string, DocHeading[]> {
  return Object.fromEntries(pages.map((page) => [page.id, extractHeadingsFromHtml(page.body)]));
}

export function DocumentsModule() {
  const activeWorkspaceId = useUIStore((s) => s.activeWorkspaceId);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [autoEditFolderId, setAutoEditFolderId] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [view, setView] = useState<DocsView>("library");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [outlines, setOutlines] = useState<Record<string, DocHeading[]>>({});
  const [pendingHeadingId, setPendingHeadingId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [assets, setAssets] = useState<DocumentAsset[]>([]);
  const [versionMessage, setVersionMessage] = useState<string | null>(null);
  const [savingVersion, setSavingVersion] = useState(false);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>([]);
  const [fieldValues, setFieldValues] = useState<DocumentFieldValue[]>([]);
  const fieldSaveTimers = useRef<Record<string, number>>({});
  const titleSaveTimer = useRef<number | null>(null);
  const documentsRef = useRef(documents);
  const foldersRef = useRef(folders);
  const activeDocIdRef = useRef(activeDocId);
  const remoteOk = useRef(false);
  documentsRef.current = documents;
  foldersRef.current = folders;
  activeDocIdRef.current = activeDocId;

  const persistLocal = useCallback(
    (nextDocuments?: Document[], nextFolders?: DocFolder[]) => {
      if (!activeWorkspaceId || remoteOk.current) return;
      persistLibrary(activeWorkspaceId, {
        documents: nextDocuments ?? documentsRef.current,
        folders: nextFolders ?? foldersRef.current,
      });
    },
    [activeWorkspaceId]
  );

  const runRemote = useCallback(
    (action: Promise<{ ok: true } | { error: string } | undefined>) => {
      void action.then((result) => {
        if (result && "error" in result) {
          remoteOk.current = false;
          persistLocal();
        }
      });
    },
    [persistLocal]
  );

  useEffect(() => {
    if (!activeWorkspaceId) {
      setDocuments([]);
      setFolders([]);
      setCurrentFolderId(null);
      setActiveDocId(null);
      setActivePageId(null);
      setOutlines({});
      setView("library");
      setReady(true);
      setVersions([]);
      setAssets([]);
      setVersionMessage(null);
      setDocTypes([]);
      setFieldDefs([]);
      setFieldValues([]);
      return;
    }

    let cancelled = false;
    setReady(false);

    async function load(workspaceId: string) {
      const result = await listDocumentLibrary(workspaceId);
      if (cancelled) return;

      if ("error" in result) {
        remoteOk.current = false;
        const loaded = loadLibrary(workspaceId);
        setDocuments(loaded.documents);
        setFolders(loaded.folders);
        setReady(true);
        return;
      }

      remoteOk.current = true;
      let library = result;
      if (hasLocalLibrary(workspaceId)) {
        const local = loadLibrary(workspaceId);
        const imported = await importLocalDocumentLibrary(workspaceId, local);
        if (!("error" in imported)) {
          clearLibrary(workspaceId);
          const refreshed = await listDocumentLibrary(workspaceId);
          if (!("error" in refreshed)) library = refreshed;
        }
      }

      if (cancelled) return;
      setDocuments(library.documents);
      setFolders(library.folders);
      setCurrentFolderId(null);
      setActiveDocId(null);
      setActivePageId(null);
      setOutlines({});
      setView("library");
      setSaveStatus("idle");
      setReady(true);
      const types = await listDocumentTypes(workspaceId);
      if (!cancelled && !("error" in types)) setDocTypes(types);
    }

    void load(activeWorkspaceId);
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

  const writeDocuments = useCallback(
    (updater: (prev: Document[]) => Document[]) => {
      setDocuments((prev) => {
        const next = updater(prev);
        persistLocal(next, foldersRef.current);
        return next;
      });
    },
    [persistLocal]
  );

  const writeFolders = useCallback(
    (updater: (prev: DocFolder[]) => DocFolder[]) => {
      setFolders((prev) => {
        const next = updater(prev);
        persistLocal(documentsRef.current, next);
        return next;
      });
    },
    [persistLocal]
  );

  const openDocument = useCallback(
    (id: string) => {
      const doc = documents.find((item) => item.id === id);
      if (!doc) return;
      const firstPage = doc.pages[0];
      setActiveDocId(doc.id);
      setActivePageId(firstPage?.id ?? null);
      setOutlines(pageOutlines(doc.pages));
      setSaveStatus("idle");
      setView("editor");
      setVersionMessage(null);
    },
    [documents]
  );

  useEffect(() => {
    if (!activeDocId || view !== "editor" || !remoteOk.current) {
      if (view !== "editor") {
        setVersions([]);
        setAssets([]);
        setFieldValues([]);
      }
      return;
    }
    let cancelled = false;
    void Promise.all([
      listDocumentVersions(activeDocId),
      listDocumentAssets(activeDocId),
      listDocumentFieldValues(activeDocId),
    ]).then(([nextVersions, nextAssets, nextValues]) => {
      if (cancelled) return;
      if (!("error" in nextVersions)) setVersions(nextVersions);
      if (!("error" in nextAssets)) setAssets(nextAssets);
      if (!("error" in nextValues)) setFieldValues(nextValues);
    });
    return () => {
      cancelled = true;
    };
  }, [activeDocId, view]);

  const activeTypeId = documents.find((doc) => doc.id === activeDocId)?.documentTypeId ?? null;

  useEffect(() => {
    if (!activeTypeId) {
      setFieldDefs([]);
      return;
    }
    let cancelled = false;
    void listFieldDefinitions(activeTypeId).then((result) => {
      if (cancelled || "error" in result) return;
      setFieldDefs(result);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTypeId]);

  const handleCreate = useCallback(() => {
    if (!activeWorkspaceId) return;
    const openDoc = documents.find((doc) => doc.id === activeDocId);
    const folderId = openDoc?.folderId ?? currentFolderId;
    const doc = createBlankDocument(activeWorkspaceId, folderId);
    writeDocuments((prev) => upsertDocument(prev, doc));
    if (remoteOk.current) {
      void createDocumentRecord({
        id: doc.id,
        workspaceId: activeWorkspaceId,
        folderId,
        title: doc.title,
        pages: doc.pages,
      }).then((created) => {
        if (created && "error" in created) {
          remoteOk.current = false;
          persistLocal();
        }
      });
    }
    setActiveDocId(doc.id);
    setActivePageId(doc.pages[0]?.id ?? null);
    setOutlines(pageOutlines(doc.pages));
    setSaveStatus("idle");
    setView("editor");
    setVersionMessage(null);
  }, [activeDocId, activeWorkspaceId, currentFolderId, documents, persistLocal, writeDocuments]);

  const persistWorkingState = useCallback(
    (documentId: string, pages: DocumentPage[], title?: string) => {
      if (!remoteOk.current) return;
      runRemote(saveDocumentWorkingState({ id: documentId, pages, title }));
    },
    [runRemote]
  );

  const flushWorkingState = useCallback(() => {
    const docId = activeDocIdRef.current;
    if (!docId) return;
    const current = documentsRef.current.find((doc) => doc.id === docId);
    if (!current) return;
    setSaveStatus("saving");
    persistWorkingState(current.id, current.pages, current.title);
    setSaveStatus("saved");
  }, [persistWorkingState]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleCreate();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flushWorkingState();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [flushWorkingState, handleCreate]);

  function persistPages(documentId: string, pages: DocumentPage[]) {
    persistWorkingState(documentId, pages);
  }

  function handleSave(pageId: string, patch: { body: string }) {
    if (!activeWorkspaceId || !activeDocId) return;
    const current = documentsRef.current.find((doc) => doc.id === activeDocId);
    if (!current) return;
    const currentPage = current.pages.find((page) => page.id === pageId);
    if (!currentPage || currentPage.body === patch.body) return;
    const pages = current.pages.map((page) =>
      page.id === pageId ? { ...page, body: patch.body } : page
    );
    const first = pages[0];
    writeDocuments((prev) =>
      prev.map((doc) =>
        doc.id === activeDocId
          ? {
              ...doc,
              pages,
              body: first?.id === pageId ? patch.body : doc.body,
              updatedAt: new Date().toISOString(),
            }
          : doc
      )
    );
    if (remoteOk.current) persistWorkingState(activeDocId, pages);
  }

  function handleDocTitleChange(title: string) {
    if (!activeDocId) return;
    setSaveStatus("saving");
    writeDocuments((prev) =>
      prev.map((doc) =>
        doc.id === activeDocId ? { ...doc, title, updatedAt: new Date().toISOString() } : doc
      )
    );
    if (titleSaveTimer.current) window.clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = window.setTimeout(() => {
      if (remoteOk.current) runRemote(updateDocumentRecord(activeDocId, { title }));
      setSaveStatus("saved");
    }, 400);
  }

  function handleRenamePage(pageId: string, title: string) {
    if (!activeDocId) return;
    const current = documentsRef.current.find((doc) => doc.id === activeDocId);
    if (!current) return;
    const pages = current.pages.map((page) => (page.id === pageId ? { ...page, title } : page));
    writeDocuments((prev) =>
      prev.map((doc) =>
        doc.id === activeDocId ? { ...doc, pages, updatedAt: new Date().toISOString() } : doc
      )
    );
    persistWorkingState(activeDocId, pages);
  }

  function handleReorderPages(pages: DocumentPage[]) {
    if (!activeDocId) return;
    writeDocuments((prev) =>
      prev.map((doc) =>
        doc.id === activeDocId ? { ...doc, pages, updatedAt: new Date().toISOString() } : doc
      )
    );
    persistPages(activeDocId, pages);
  }

  function handleAddPage() {
    if (!activeWorkspaceId || !activeDocId) return;
    const current = documentsRef.current.find((doc) => doc.id === activeDocId);
    if (!current) return;
    const page = createBlankPage();
    const pages = [...current.pages, page];
    writeDocuments((prev) =>
      prev.map((doc) =>
        doc.id === activeDocId ? { ...doc, pages, updatedAt: new Date().toISOString() } : doc
      )
    );
    persistPages(activeDocId, pages);
    setActivePageId(page.id);
    setOutlines((prev) => ({ ...prev, [page.id]: [] }));
    setSaveStatus("idle");
  }

  function handleAddSubPage(parentId: string) {
    if (!activeWorkspaceId || !activeDocId) return;
    const current = documents.find((doc) => doc.id === activeDocId);
    if (!current) return;
    const parentIndex = current.pages.findIndex((page) => page.id === parentId);
    const parent = current.pages[parentIndex];
    if (!parent || parent.level >= 2) return;
    const page = createBlankPage(parent.level + 1);
    let insertAt = parentIndex + 1;
    while (insertAt < current.pages.length && current.pages[insertAt]!.level > parent.level) {
      insertAt += 1;
    }
    const pages = [...current.pages];
    pages.splice(insertAt, 0, page);
    writeDocuments((prev) =>
      prev.map((doc) =>
        doc.id === activeDocId ? { ...doc, pages, updatedAt: new Date().toISOString() } : doc
      )
    );
    persistPages(activeDocId, pages);
    setActivePageId(page.id);
    setOutlines((prev) => ({ ...prev, [page.id]: [] }));
    setSaveStatus("idle");
  }

  function handleClosePage(pageId: string) {
    if (!activeDocId) return;
    const current = documentsRef.current.find((doc) => doc.id === activeDocId);
    if (!current || current.pages.length <= 1) return;
    const start = current.pages.findIndex((page) => page.id === pageId);
    if (start === -1) return;
    const level = current.pages[start]!.level;
    const removed = new Set<string>();
    for (let i = start; i < current.pages.length; i += 1) {
      const page = current.pages[i]!;
      if (i === start || page.level > level) removed.add(page.id);
      else break;
    }
    const pages = current.pages.filter((page) => !removed.has(page.id));
    if (pages.length === 0) return;
    writeDocuments((prev) =>
      prev.map((doc) =>
        doc.id === activeDocId
          ? {
              ...doc,
              pages,
              body: pages[0]?.body ?? doc.body,
              updatedAt: new Date().toISOString(),
            }
          : doc
      )
    );
    persistPages(activeDocId, pages);
    if (activePageId && removed.has(activePageId)) {
      setActivePageId(pages[Math.max(0, start - 1)]?.id ?? pages[0]?.id ?? null);
      setSaveStatus("idle");
    }
  }

  function handleCreateFolder() {
    if (!activeWorkspaceId) return;
    const folder = createBlankFolder(activeWorkspaceId, currentFolderId);
    writeFolders((prev) => [...prev, folder]);
    if (remoteOk.current) {
      runRemote(
        createFolderRecord({
          id: folder.id,
          workspaceId: activeWorkspaceId,
          parentId: currentFolderId,
          name: folder.name,
        })
      );
    }
    setAutoEditFolderId(folder.id);
  }

  function handleRenameFolder(id: string, name: string) {
    writeFolders((prev) => prev.map((folder) => (folder.id === id ? { ...folder, name } : folder)));
    if (remoteOk.current) runRemote(renameFolderRecord(id, name));
    setAutoEditFolderId(null);
  }

  function handleMoveDocument(docId: string, folderId: string | null) {
    writeDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId ? { ...doc, folderId, updatedAt: new Date().toISOString() } : doc
      )
    );
    if (remoteOk.current) runRemote(updateDocumentRecord(docId, { folderId }));
  }

  function handleDeleteFolder(id: string) {
    const folder = folders.find((item) => item.id === id);
    if (!folder || !activeWorkspaceId) return;
    const parentId = folder.parentId;
    const nextDocuments = documents.map((doc) =>
      doc.folderId === id ? { ...doc, folderId: parentId } : doc
    );
    const nextFolders = folders
      .filter((item) => item.id !== id)
      .map((item) => (item.parentId === id ? { ...item, parentId } : item));
    setDocuments(nextDocuments);
    setFolders(nextFolders);
    persistLocal(nextDocuments, nextFolders);
    if (remoteOk.current) runRemote(deleteFolderRecord({ id, parentId }));
    if (currentFolderId === id) setCurrentFolderId(parentId);
    setAutoEditFolderId(null);
  }

  function handleDelete(id: string) {
    if (!activeWorkspaceId) return;
    writeDocuments((prev) => prev.filter((doc) => doc.id !== id));
    if (remoteOk.current) runRemote(deleteDocumentRecord(id));
    if (activeDocId === id) {
      setActiveDocId(null);
      setActivePageId(null);
      setView("library");
    }
    setSaveStatus("idle");
  }

  async function handleSaveVersion(label: string) {
    const docId = activeDocIdRef.current;
    const current = documentsRef.current.find((doc) => doc.id === docId);
    if (!current || !remoteOk.current) return;
    setSavingVersion(true);
    setVersionMessage(null);
    const flushed = await saveDocumentWorkingState({
      id: current.id,
      pages: current.pages,
      title: current.title,
    });
    if ("error" in flushed) {
      remoteOk.current = false;
      persistLocal();
      setVersionMessage(flushed.error);
      setSavingVersion(false);
      return;
    }
    const result = await saveDocumentVersion({ documentId: current.id, label });
    setSavingVersion(false);
    if ("error" in result) {
      setVersionMessage(result.error);
      return;
    }
    setVersions((prev) => {
      const without = prev.filter((item) => item.id !== result.version.id);
      return [result.version, ...without].sort((a, b) => b.versionNumber - a.versionNumber);
    });
    setVersionMessage(
      result.alreadySaved
        ? `Current state is already saved as v${result.version.versionNumber}`
        : `Saved v${result.version.versionNumber}`
    );
  }

  async function handleToggleHighlighted(id: string, highlighted: boolean) {
    setVersions((prev) =>
      prev.map((version) => (version.id === id ? { ...version, highlighted } : version))
    );
    const result = await setDocumentVersionHighlighted(id, highlighted);
    if ("error" in result) {
      setVersionMessage(result.error);
    }
  }

  async function handleAttachFile(file: File) {
    const docId = activeDocIdRef.current;
    if (!docId || !remoteOk.current) return;
    const data = new FormData();
    data.set("documentId", docId);
    data.set("file", file);
    const result = await attachDocumentAsset(data);
    if ("error" in result) {
      setVersionMessage(result.error);
      return;
    }
    setAssets((prev) => [result.asset, ...prev]);
  }

  async function handleOpenAsset(id: string) {
    const result = await createDocumentAssetUrl(id);
    if ("error" in result) {
      setVersionMessage(result.error);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  function handleTypeChange(typeId: string | null) {
    const docId = activeDocIdRef.current;
    if (!docId) return;
    writeDocuments((prev) =>
      prev.map((doc) => (doc.id === docId ? { ...doc, documentTypeId: typeId } : doc))
    );
    if (remoteOk.current) {
      void setDocumentType(docId, typeId).then((result) => {
        if (result && "error" in result) return;
        void listDocumentFieldValues(docId).then((values) => {
          if (!("error" in values)) setFieldValues(values);
        });
      });
    }
  }

  function handleFieldChange(field: FieldDefinition, value: unknown) {
    const docId = activeDocIdRef.current;
    if (!docId) return;
    setFieldValues((prev) => {
      const existing = prev.find((item) => item.fieldDefinitionId === field.id);
      if (existing) {
        return prev.map((item) => (item.id === existing.id ? { ...item, value } : item));
      }
      return [
        ...prev,
        {
          id: `local-${field.id}`,
          documentId: docId,
          fieldDefinitionId: field.id,
          localFieldKey: null,
          value,
        },
      ];
    });
    const currentTimer = fieldSaveTimers.current[field.id];
    if (currentTimer) window.clearTimeout(currentTimer);
    fieldSaveTimers.current[field.id] = window.setTimeout(() => {
      if (!remoteOk.current) return;
      void upsertDocumentFieldValue({
        documentId: docId,
        fieldDefinitionId: field.id,
        fieldType: field.fieldType,
        value,
      });
    }, 400);
  }

  const activeDocument = documents.find((doc) => doc.id === activeDocId) ?? null;
  const activePage = activeDocument?.pages.find((page) => page.id === activePageId) ?? null;
  const inEditor = view === "editor" && activeDocument && activePage;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 flex-none items-center gap-2 border-b border-border px-3">
        {inEditor && (
          <button
            onClick={() => {
              setCurrentFolderId(activeDocument?.folderId ?? currentFolderId);
              setView("library");
            }}
            aria-label="Back to all documents"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={15} />
          </button>
        )}
        <span className="text-sm font-semibold text-foreground">
          {inEditor ? "Documents" : "All documents"}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {inEditor && (
            <span className="text-[11px] text-muted-foreground" aria-live="polite">
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "saved" && "Saved"}
            </span>
          )}
          {!inEditor && (
            <button
              onClick={handleCreateFolder}
              disabled={!activeWorkspaceId}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <FolderPlus size={12} />
              New folder
            </button>
          )}
          <button
            onClick={handleCreate}
            disabled={!activeWorkspaceId}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <Plus size={12} />
            New document
          </button>
        </div>
      </div>

      {inEditor && activeDocument && (
        <div className="flex h-10 flex-none items-center border-b border-border px-3">
          <input
            value={activeDocument.title}
            onChange={(e) => handleDocTitleChange(e.target.value)}
            placeholder="Titre principal"
            aria-label="Titre principal"
            className="w-full bg-transparent text-sm font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      )}

      {!ready ? (
        <div className="flex-1" />
      ) : inEditor && activeDocument && activePage ? (
        <div className="flex min-h-0 flex-1">
          <DocumentTabs
            pages={activeDocument.pages}
            activeId={activePageId}
            outlines={outlines}
            onSelect={(id) => {
              setActivePageId(id);
              setSaveStatus("idle");
            }}
            onClose={handleClosePage}
            onAdd={handleAddPage}
            onAddSubTab={handleAddSubPage}
            onRename={handleRenamePage}
            onReorder={handleReorderPages}
            onJumpToHeading={(pageId, headingId) => {
              if (pageId !== activePageId) {
                setActivePageId(pageId);
                setSaveStatus("idle");
                setPendingHeadingId(headingId);
                return;
              }
              document.getElementById(headingId)?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }}
          />
          <div className="min-w-0 flex-1">
            <DocumentEditor
              key={activePage.id}
              document={{
                ...activeDocument,
                id: activePage.id,
                title: activePage.title,
                body: activePage.body,
              }}
              onSave={handleSave}
              onStatusChange={setSaveStatus}
              onOutlineChange={(headings) =>
                setOutlines((prev) => ({ ...prev, [activePage.id]: headings }))
              }
              scrollToHeadingId={pendingHeadingId}
              onScrolledToHeading={() => setPendingHeadingId(null)}
            />
          </div>
          <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-l border-border bg-background">
            <DocumentProperties
              types={docTypes}
              typeId={activeDocument.documentTypeId}
              fields={fieldDefs}
              values={fieldValues}
              onTypeChange={handleTypeChange}
              onFieldChange={handleFieldChange}
            />
            <DocumentHistory
              versions={versions}
              assets={assets}
              versionMessage={versionMessage}
              savingVersion={savingVersion}
              onSaveVersion={(label) => void handleSaveVersion(label)}
              onToggleHighlighted={(id, highlighted) =>
                void handleToggleHighlighted(id, highlighted)
              }
              onAttachFile={(file) => void handleAttachFile(file)}
              onOpenAsset={(id) => void handleOpenAsset(id)}
            />
          </aside>
        </div>
      ) : (
        <DocumentsLibrary
          documents={documents}
          folders={folders}
          currentFolderId={currentFolderId}
          canCreate={Boolean(activeWorkspaceId)}
          onOpen={openDocument}
          onOpenFolder={setCurrentFolderId}
          onCreate={handleCreate}
          onCreateFolder={handleCreateFolder}
          onDelete={handleDelete}
          onDeleteFolder={handleDeleteFolder}
          onRenameFolder={handleRenameFolder}
          onMoveDocument={handleMoveDocument}
          autoEditFolderId={autoEditFolderId}
        />
      )}
    </div>
  );
}
