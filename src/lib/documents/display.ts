import type { Document } from "./types";

export function displayFolderName(name: string): string {
  return name.trim() || "Untitled folder";
}

export function displayTitle(doc: Document): string {
  const fromDoc = doc.title.trim();
  if (fromDoc) return fromDoc;
  const fromPage = doc.pages?.[0]?.title.trim();
  return fromPage || "Untitled";
}

export function firstWordsFromHtml(html: string, maxWords = 6): string {
  const text = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.split(" ").slice(0, maxWords).join(" ");
}

export function displayPageTitle(title: string, body = ""): string {
  const named = title.trim();
  if (named) return named;
  return firstWordsFromHtml(body) || "Untitled";
}

export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
