import { create } from "zustand";

export type Module = "dashboard" | "tasks" | "email" | "documents" | "agents";

const STORAGE_KEY = "embar-module";

interface UIStore {
  activeModule: Module;
  activeWorkspaceId: string;
  setActiveModule: (module: Module) => void;
  setActiveWorkspaceId: (id: string) => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  activeModule: "dashboard",
  activeWorkspaceId: "",
  setActiveModule: (module) => {
    set({ activeModule: module });
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, module);
    }
  },
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
}));
