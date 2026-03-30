export interface WorkspaceData {
  id: string;
  name: string;
  type: "personal" | "professional" | "project";
}

export interface EntityData {
  id: string;
  name: string;
  color: string;
  position: number;
  mode: string | null;
}
