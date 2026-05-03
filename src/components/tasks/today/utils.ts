import type { ItemData } from "@/lib/types";

export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const TODAY = toLocalDateStr(new Date());

export const SCHEDULE_START = 6;
export const SCHEDULE_END = 21;
export const HOURS = Array.from(
  { length: SCHEDULE_END - SCHEDULE_START },
  (_, i) => i + SCHEDULE_START
);
export const PX_PER_HOUR = 60;

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hr = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  const suffix = (h ?? 0) < 12 ? "am" : "pm";
  return m ? `${hr}:${String(m).padStart(2, "0")} ${suffix}` : `${hr} ${suffix}`;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(d: string): string {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getDaysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Math.floor(
    (new Date(TODAY + "T00:00:00").getTime() - new Date(dateStr + "T00:00:00").getTime()) /
      86_400_000
  );
  return diff > 0 ? diff : null;
}

export function overdueBadge(dateStr: string | null): string | null {
  const d = getDaysAgo(dateStr);
  if (!d) return null;
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

export function timeToTop(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h ?? 0) - SCHEDULE_START) * PX_PER_HOUR + ((m ?? 0) / 60) * PX_PER_HOUR;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function computeScheduleLayout(
  items: ItemData[]
): Map<string, { col: number; totalCols: number }> {
  if (items.length === 0) return new Map();

  const slots = items.map((item) => ({
    id: item.id,
    start: timeToMinutes(item.scheduled_time!),
    end: timeToMinutes(item.scheduled_time!) + Math.max(item.duration_estimate ?? 30, 30),
  }));

  const cols: number[] = new Array(slots.length).fill(-1);
  for (let i = 0; i < slots.length; i++) {
    const usedCols = new Set(
      slots.slice(0, i).flatMap((other, j) => {
        const overlaps = other.start < slots[i]!.end && other.end > slots[i]!.start;
        return overlaps ? [cols[j]!] : [];
      })
    );
    let c = 0;
    while (usedCols.has(c)) c++;
    cols[i] = c;
  }

  const result = new Map<string, { col: number; totalCols: number }>();
  slots.forEach((slot, i) => {
    const groupCols = slots
      .map((other, j) => (other.start < slot.end && other.end > slot.start ? cols[j]! : -1))
      .filter((c) => c >= 0);
    result.set(slot.id, { col: cols[i]!, totalCols: Math.max(...groupCols) + 1 });
  });

  return result;
}
