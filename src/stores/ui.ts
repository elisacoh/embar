import { create } from "zustand";

export type Module = "dashboard" | "tasks" | "email" | "documents" | "agents";

const STORAGE_KEY = "embar-module";

interface UIStore {
  activeModule: Module;
  activeWorkspaceId: string;
  showAllWorkspaces: boolean;
  setActiveModule: (module: Module) => void;
  setActiveWorkspaceId: (id: string) => void;
  setShowAllWorkspaces: (value: boolean) => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  activeModule: "dashboard",
  activeWorkspaceId: "",
  showAllWorkspaces: false,
  setActiveModule: (module) => {
    set({ activeModule: module });
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, module);
    }
  },
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  setShowAllWorkspaces: (value) => set({ showAllWorkspaces: value }),
}));
