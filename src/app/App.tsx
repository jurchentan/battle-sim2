import type { ComponentType } from 'react';
import { useAppStore, type Workspace } from '../state/appStore';
import { ArmyWorkspace } from './workspaces/ArmyWorkspace';
import { ScenarioWorkspace } from './workspaces/ScenarioWorkspace';
import { TerrainWorkspace } from './workspaces/TerrainWorkspace';
import { WorkspaceTabs } from './WorkspaceTabs';

const WORKSPACE_PANELS: Record<Workspace, ComponentType> = {
  terrain: TerrainWorkspace,
  army: ArmyWorkspace,
  scenario: ScenarioWorkspace,
};

export function App() {
  const workspace = useAppStore((state) => state.workspace);
  const ActiveWorkspace = WORKSPACE_PANELS[workspace];

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[#d8cdb5] bg-[#f8f2e5]/95">
        <div className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div>
            <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[#8a7a58] uppercase">
              Local-first battle cartography
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[#2f2b23]">
              Battle Map Editor
            </h1>
          </div>
          <WorkspaceTabs />
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {workspace === 'terrain' ? (
          <ActiveWorkspace />
        ) : (
          <div className="h-full overflow-auto">
            <div className="mx-auto w-full max-w-6xl px-6 py-8">
              <ActiveWorkspace />
            </div>
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t border-[#d8cdb5] bg-[#f1e9d8]/80">
        <div className="flex w-full flex-wrap items-center justify-between gap-2 px-6 py-2 text-xs text-[#7c715c]">
          <span>Milestone M1 · Canvas foundation</span>
          <span>Desktop workspace · No accounts or network required</span>
        </div>
      </footer>
    </div>
  );
}
