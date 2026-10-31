import type { Workspace } from '../state/appStore';

export interface WorkspaceOption {
  id: Workspace;
  label: string;
  milestone: string;
}

export const WORKSPACE_OPTIONS: readonly WorkspaceOption[] = [
  { id: 'terrain', label: 'Terrain Editor', milestone: 'M1-M3' },
  { id: 'army', label: 'Army Roster Editor', milestone: 'M4' },
  { id: 'scenario', label: 'Scenario Editor', milestone: 'M5-M6' },
];
