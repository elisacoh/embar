export interface WorkspaceData {
  id: string;
  name: string;
  type: "personal" | "professional" | "project";
  is_default: boolean;
  is_personal: boolean;
}

export interface EntityData {
  id: string;
  name: string;
  color: string;
  position: number;
  mode: string | null;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface ItemData {
  id: string;
  workspace_id: string;
  entity_id: string | null;
  title: string;
  description: string | null;
  state: string;
  urgency: string;
  work_type: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_estimate: number | null;
  duration_actual: number | null;
  due_date: string | null;
  hard_deadline: boolean;
  is_fixed: boolean;
  assigned_to: string | null;
  waiting_for: string | null;
  subtasks: Subtask[];
  metadata: Record<string, unknown> | null;
  completed_at: string | null;
  created_at: string;
  time_spent_ms: number;
  position: number;
}
