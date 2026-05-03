export const SECTIONS = [
  { state: "focus", label: "Focus", dot: "bg-brand-500", color: "text-brand-500" },
  {
    state: "planned",
    label: "Planned",
    dot: "bg-blue-500",
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    state: "carry-on",
    label: "Carry-on",
    dot: "bg-red-500",
    color: "text-red-600 dark:text-red-400",
  },
  {
    state: "unplanned",
    label: "Later",
    dot: "bg-muted-foreground/40",
    color: "text-muted-foreground",
  },
  {
    state: "someday",
    label: "Someday",
    dot: "bg-purple-500",
    color: "text-purple-600 dark:text-purple-400",
  },
  {
    state: "done",
    label: "Done",
    dot: "bg-green-500",
    color: "text-green-600 dark:text-green-400",
  },
] as const;

export type SectionState = (typeof SECTIONS)[number]["state"];

export const TIMER_LS_KEY = "embar:focus-timer";
export const SESSION_TIMER_LS_KEY = "embar:session-timer";

export interface TimerState {
  itemId: string;
  elapsed: number;
  startedAt: number | null;
}

export interface SessionTimerState {
  sessionId: string;
  elapsed: number;
  startedAt: number | null;
}

export function loadTimer(): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_LS_KEY);
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
}

export function saveTimer(t: TimerState | null) {
  try {
    if (t) localStorage.setItem(TIMER_LS_KEY, JSON.stringify(t));
    else localStorage.removeItem(TIMER_LS_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSessionTimer(): SessionTimerState | null {
  try {
    const raw = localStorage.getItem(SESSION_TIMER_LS_KEY);
    return raw ? (JSON.parse(raw) as SessionTimerState) : null;
  } catch {
    return null;
  }
}

export function saveSessionTimer(t: SessionTimerState | null) {
  try {
    if (t) localStorage.setItem(SESSION_TIMER_LS_KEY, JSON.stringify(t));
    else localStorage.removeItem(SESSION_TIMER_LS_KEY);
  } catch {
    /* ignore */
  }
}

export function timerMs(t: TimerState): number {
  return t.elapsed + (t.startedAt ? Date.now() - t.startedAt : 0);
}

export function sessionTimerMs(t: SessionTimerState): number {
  return t.elapsed + (t.startedAt ? Date.now() - t.startedAt : 0);
}

export interface DragTargetProps {
  isDragTarget: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
}
