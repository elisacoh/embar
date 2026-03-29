import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Module = "dashboard" | "tasks" | "email" | "documents" | "agents";

interface UIStore {
  activeModule: Module;
  setActiveModule: (module: Module) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      activeModule: "dashboard",
      setActiveModule: (module) => set({ activeModule: module }),
    }),
    {
      name: "embar-ui",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
