import { useAppStore } from '../state/appStore';
import { WORKSPACE_OPTIONS } from './workspaceConfig';

export function WorkspaceTabs() {
  const workspace = useAppStore((state) => state.workspace);
  const setWorkspace = useAppStore((state) => state.setWorkspace);

  return (
    <div
      role="tablist"
      aria-label="Editor workspaces"
      className="flex flex-wrap items-center gap-1 rounded-lg border border-[#cfc3a8] bg-[#efe6d5] p-1"
    >
      {WORKSPACE_OPTIONS.map((option) => {
        const selected = option.id === workspace;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            id={`workspace-tab-${option.id}`}
            aria-selected={selected}
            aria-controls={`workspace-panel-${option.id}`}
            onClick={() => setWorkspace(option.id)}
            className={[
              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              selected
                ? 'bg-[#3d4b3f] text-[#f7f2e6] shadow-sm'
                : 'text-[#5f594b] hover:bg-[#e1d5bf] hover:text-[#2f2b23]',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
