import type { ReactNode } from 'react';
import type { Workspace } from '../state/appStore';

interface WorkspacePanelProps {
  workspace: Workspace;
  title: string;
  milestone: string;
  scope: string;
  children: ReactNode;
}

export function WorkspacePanel({
  workspace,
  title,
  milestone,
  scope,
  children,
}: WorkspacePanelProps) {
  return (
    <section
      role="tabpanel"
      id={`workspace-panel-${workspace}`}
      aria-labelledby={`workspace-tab-${workspace}`}
      className="flex flex-col gap-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[#2f2b23]">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6b6353]">{scope}</p>
        </div>
        <span className="rounded-full border border-[#c9b98f] bg-[#f0e5cc] px-3 py-1 text-xs font-semibold tracking-wide text-[#6b5426] uppercase">
          Planned {milestone}
        </span>
      </header>
      {children}
    </section>
  );
}
