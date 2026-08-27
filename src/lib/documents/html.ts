export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function toEditorHtml(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return body;
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function isEditorEmpty(html: string): boolean {
  return (
    html
      .replace(/<br\s*\/?>/gi, "")
      .replace(/&nbsp;/g, " ")
      .replace(/<[^>]+>/g, "")
      .trim().length === 0
  );
}

export function restoreSelection(range: Range | null): void {
  if (!range) return;
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
}

export function captureSelection(): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  return selection.getRangeAt(0).cloneRange();
}

export function applyInlineStyle(property: string, value: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  const span = document.createElement("span");
  span.style.setProperty(property, value);

  if (range.collapsed) {
    span.appendChild(document.createTextNode("\u200b"));
    range.insertNode(span);
    const next = document.createRange();
    next.setStart(span.firstChild ?? span, 1);
    next.collapse(true);
    selection.removeAllRanges();
    selection.addRange(next);
    return;
  }

  try {
    range.surroundContents(span);
  } catch {
    span.appendChild(range.extractContents());
    range.insertNode(span);
  }

  const next = document.createRange();
  next.selectNodeContents(span);
  selection.removeAllRanges();
  selection.addRange(next);
}

export function applyCommand(command: string, value?: string): void {
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand(command, false, value);
}

export type HeadingLevel = 1 | 2 | 3;
export type BlockStyle = "p" | "h1" | "h2" | "h3";

export interface DocHeading {
  id: string;
  level: HeadingLevel;
  text: string;
}

export function applyBlockFormat(tag: BlockStyle): void {
  const applied = document.execCommand("formatBlock", false, `<${tag}>`);
  if (!applied) document.execCommand("formatBlock", false, tag);
}

export function currentBlockStyle(): BlockStyle {
  try {
    const raw = document.queryCommandValue("formatBlock").toLowerCase();
    if (raw === "h1" || raw === "h2" || raw === "h3") return raw;
  } catch {
    // no editable selection
  }
  return "p";
}

export function syncHeadingOutline(root: HTMLElement): DocHeading[] {
  const outline: DocHeading[] = [];
  root.querySelectorAll("h1, h2, h3").forEach((node, index) => {
    const el = node as HTMLElement;
    if (!el.id) {
      el.id = `doc-h-${index}-${Math.random().toString(36).slice(2, 8)}`;
    }
    const level = Number(el.tagName.replace("H", "")) as HeadingLevel;
    const text = el.textContent?.replace(/\u200b/g, "").trim() || "Untitled heading";
    outline.push({ id: el.id, level, text });
  });
  return outline;
}

export function extractHeadingsFromHtml(html: string): DocHeading[] {
  if (typeof document === "undefined" || !html.trim()) return [];
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  return syncHeadingOutline(wrap);
}
