"use client";

import { useEffect, useRef, useState } from "react";
import type { Document } from "@/lib/documents/types";
import {
  isEditorEmpty,
  syncHeadingOutline,
  toEditorHtml,
  type DocHeading,
} from "@/lib/documents/html";
import { FormatToolbar } from "./FormatToolbar";
import { cn } from "@/lib/utils";

interface DocumentEditorProps {
  document: Document;
  onSave: (id: string, patch: { body: string }) => void;
  onStatusChange?: (status: "idle" | "saving" | "saved") => void;
  onOutlineChange?: (headings: DocHeading[]) => void;
  scrollToHeadingId?: string | null;
  onScrolledToHeading?: () => void;
}

export function DocumentEditor({
  document,
  onSave,
  onStatusChange,
  onOutlineChange,
  scrollToHeadingId,
  onScrolledToHeading,
}: DocumentEditorProps) {
  const [body, setBody] = useState(document.body);
  const [empty, setEmpty] = useState(isEditorEmpty(document.body));
  const editorRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef(body);
  const onSaveRef = useRef(onSave);
  const onStatusChangeRef = useRef(onStatusChange);
  const onOutlineChangeRef = useRef(onOutlineChange);

  bodyRef.current = body;
  onSaveRef.current = onSave;
  onStatusChangeRef.current = onStatusChange;
  onOutlineChangeRef.current = onOutlineChange;

  useEffect(() => {
    onStatusChangeRef.current?.("idle");
    if (editorRef.current) {
      editorRef.current.innerHTML = toEditorHtml(document.body);
      const headings = syncHeadingOutline(editorRef.current);
      const html = editorRef.current.innerHTML;
      setBody(html);
      bodyRef.current = html;
      setEmpty(isEditorEmpty(html));
      onOutlineChangeRef.current?.(headings);
    }
    // Load once per page — do not reset after autosave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  useEffect(() => {
    if (body === document.body) return;

    onStatusChangeRef.current?.("saving");
    const timer = window.setTimeout(() => {
      onSaveRef.current(document.id, { body: bodyRef.current });
      onStatusChangeRef.current?.("saved");
    }, 700);

    return () => window.clearTimeout(timer);
  }, [body, document.id, document.body]);

  useEffect(() => {
    return () => {
      if (bodyRef.current !== document.body) {
        onSaveRef.current(document.id, { body: bodyRef.current });
      }
    };
    // Flush only when leaving this page instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  useEffect(() => {
    if (!scrollToHeadingId || !editorRef.current) return;
    const target = editorRef.current.querySelector(`#${CSS.escape(scrollToHeadingId)}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    onScrolledToHeading?.();
  }, [scrollToHeadingId, onScrolledToHeading]);

  function syncBodyFromEditor() {
    if (!editorRef.current) return;
    const headings = syncHeadingOutline(editorRef.current);
    const html = editorRef.current.innerHTML;
    setEmpty(isEditorEmpty(html));
    setBody(html);
    bodyRef.current = html;
    onOutlineChangeRef.current?.(headings);
  }

  return (
    <div className="flex h-full flex-col">
      <FormatToolbar onApplied={syncBodyFromEditor} />

      <div className="doc-canvas flex-1 overflow-auto pb-32 pt-6">
        <div className="doc-page mx-auto">
          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-label="Document body"
            data-placeholder="Start writing…"
            suppressContentEditableWarning
            onInput={syncBodyFromEditor}
            className={cn("doc-editor outline-none", empty && "is-empty")}
          />
        </div>
      </div>
    </div>
  );
}
