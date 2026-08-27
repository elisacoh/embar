"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronUp,
  Italic,
  Underline,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyBlockFormat,
  applyCommand,
  applyInlineStyle,
  captureSelection,
  currentBlockStyle,
  restoreSelection,
  type BlockStyle,
} from "@/lib/documents/html";

const BLOCKS: { label: string; value: BlockStyle }[] = [
  { label: "Default", value: "p" },
  { label: "Title 1", value: "h1" },
  { label: "Title 2", value: "h2" },
  { label: "Title 3", value: "h3" },
];

const FONTS = [
  { label: "Sans", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times", value: "'Times New Roman', Times, serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Mono", value: "ui-monospace, 'Courier New', monospace" },
];

const DEFAULT_FONT = FONTS[0]?.value ?? "Inter, ui-sans-serif, system-ui, sans-serif";

const SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "32px", "48px"];

const COLORS = [
  { label: "Default", value: "" },
  { label: "Black", value: "#111827" },
  { label: "Gray", value: "#6b7280" },
  { label: "Orange", value: "#ea580c" },
  { label: "Red", value: "#dc2626" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#059669" },
  { label: "Purple", value: "#7c3aed" },
];

const STORAGE_KEY = "embar-docs-format-bar";

interface FormatToolbarProps {
  onApplied: () => void;
}

function ToolButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
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
  return <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />;
}

export function FormatToolbar({ onApplied }: FormatToolbarProps) {
  const [expanded, setExpanded] = useState(true);
  const [font, setFont] = useState(DEFAULT_FONT);
  const [size, setSize] = useState("16px");
  const [color, setColor] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const [block, setBlock] = useState<BlockStyle>("p");
  const [marks, setMarks] = useState({
    bold: false,
    italic: false,
    underline: false,
    align: "left",
  });
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "collapsed") setExpanded(false);
  }, []);

  useEffect(() => {
    function onSelectionChange() {
      const selection = window.getSelection();
      const node = selection?.anchorNode;
      const el = node instanceof Element ? node : node?.parentElement;
      if (!el?.closest(".doc-editor")) return;
      setBlock(currentBlockStyle());
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  function persistExpanded(next: boolean) {
    setExpanded(next);
    localStorage.setItem(STORAGE_KEY, next ? "expanded" : "collapsed");
  }

  function rememberSelection() {
    savedRange.current = captureSelection();
    try {
      setBlock(currentBlockStyle());
      setMarks({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        align: document.queryCommandState("justifyCenter")
          ? "center"
          : document.queryCommandState("justifyRight")
            ? "right"
            : document.queryCommandState("justifyFull")
              ? "justify"
              : "left",
      });
    } catch {
      // queryCommandState can throw if there is no editable selection
    }
  }

  function run(action: () => void) {
    restoreSelection(savedRange.current);
    action();
    rememberSelection();
    onApplied();
  }

  return (
    <div
      className="flex-none border-b border-border bg-background"
      onMouseDown={(event) => {
        const target = event.target as HTMLElement;
        if (!target.closest("select, input")) event.preventDefault();
        rememberSelection();
      }}
    >
      <div className="flex h-8 items-center justify-between px-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Formatting
        </span>
        <button
          type="button"
          onClick={() => persistExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? "Hide formatting toolbar" : "Show formatting toolbar"}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {expanded ? "Hide" : "Show"}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
            <select
              aria-label="Text style"
              value={block}
              onChange={(event) => {
                const next = event.target.value as BlockStyle;
                setBlock(next);
                run(() => applyBlockFormat(next));
              }}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-brand-500"
            >
              {BLOCKS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Font"
              value={font}
              onChange={(event) => {
                const next = event.target.value;
                setFont(next);
                run(() => applyInlineStyle("font-family", next));
              }}
              className="h-7 max-w-[120px] rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-brand-500"
            >
              {FONTS.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Font size"
              value={size}
              onChange={(event) => {
                const next = event.target.value;
                setSize(next);
                run(() => applyInlineStyle("font-size", next));
              }}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-brand-500"
            >
              {SIZES.map((item) => (
                <option key={item} value={item}>
                  {item.replace("px", "")}
                </option>
              ))}
            </select>

            <Divider />

            <ToolButton
              label="Bold"
              active={marks.bold}
              onClick={() => run(() => applyCommand("bold"))}
            >
              <Bold size={13} />
            </ToolButton>
            <ToolButton
              label="Italic"
              active={marks.italic}
              onClick={() => run(() => applyCommand("italic"))}
            >
              <Italic size={13} />
            </ToolButton>
            <ToolButton
              label="Underline"
              active={marks.underline}
              onClick={() => run(() => applyCommand("underline"))}
            >
              <Underline size={13} />
            </ToolButton>

            <div className="relative">
              <button
                type="button"
                title="Text color"
                aria-label="Text color"
                aria-expanded={colorOpen}
                onClick={() => setColorOpen((open) => !open)}
                className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="text-xs font-semibold">A</span>
                <span
                  className="h-1 w-4 rounded-full"
                  style={{ backgroundColor: color || "currentColor" }}
                />
              </button>
              {colorOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setColorOpen(false)} />
                  <div className="absolute left-0 top-full z-50 mt-1.5 flex items-center gap-1.5 rounded-xl border border-border bg-popover p-2 shadow-xl">
                    {COLORS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        title={item.label}
                        aria-label={item.label}
                        onClick={() => {
                          setColor(item.value);
                          setColorOpen(false);
                          run(() => applyInlineStyle("color", item.value || "inherit"));
                        }}
                        className={cn(
                          "h-5 w-5 rounded-full border border-border transition-transform hover:scale-110",
                          item.value ? "" : "bg-foreground/10"
                        )}
                        style={item.value ? { backgroundColor: item.value } : undefined}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Custom color"
                      value={color || "#111827"}
                      onChange={(event) => {
                        const next = event.target.value;
                        setColor(next);
                        run(() => applyInlineStyle("color", next));
                      }}
                      className="h-5 w-5 cursor-pointer rounded-full border border-border bg-transparent p-0"
                    />
                  </div>
                </>
              )}
            </div>

            <Divider />

            <ToolButton
              label="Align left"
              active={marks.align === "left"}
              onClick={() => run(() => applyCommand("justifyLeft"))}
            >
              <AlignLeft size={13} />
            </ToolButton>
            <ToolButton
              label="Align center"
              active={marks.align === "center"}
              onClick={() => run(() => applyCommand("justifyCenter"))}
            >
              <AlignCenter size={13} />
            </ToolButton>
            <ToolButton
              label="Align right"
              active={marks.align === "right"}
              onClick={() => run(() => applyCommand("justifyRight"))}
            >
              <AlignRight size={13} />
            </ToolButton>
            <ToolButton
              label="Justify"
              active={marks.align === "justify"}
              onClick={() => run(() => applyCommand("justifyFull"))}
            >
              <AlignJustify size={13} />
            </ToolButton>
          </div>
        </div>
      </div>
    </div>
  );
}
