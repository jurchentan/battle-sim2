import { create } from 'zustand';

export type Workspace = 'terrain' | 'army' | 'scenario';

export interface AppState {
  workspace: Workspace;
  setWorkspace: (workspace: Workspace) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  workspace: 'terrain',
  setWorkspace: (workspace) => set({ workspace }),
}));
